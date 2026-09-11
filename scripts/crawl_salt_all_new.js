/**
 * scripts/crawl_salt_all_new.js
 *
 * Fully automated script to:
 * 1. Crawl AnimeSalt.cx (homepage, series pages 1-3, movies pages 1-2)
 * 2. Find brand new anime series / movies not in anime-db.json
 * 3. Find newly released episodes for existing series in anime-db.json
 * 4. Enrich metadata with TMDB and AniList
 * 5. Update anime-db.json and regenerate anime-catalog.json
 */

const fs = require('fs');
const path = require('path');
const cheerio = require('cheerio');

const DB_PATH = path.join(__dirname, '..', 'src', 'data', 'anime-db.json');
const CATALOG_PATH = path.join(__dirname, '..', 'src', 'data', 'anime-catalog.json');
const TMDB_KEY = process.env.TMDB_API_KEY || '119b065ce02f9f479565d6b99a758ee2';

const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

async function fetchWithUA(url, retries = 3, timeoutMs = 15000) {
  for (let attempt = 1; attempt <= retries; attempt++) {
    const controller = new AbortController();
    const id = setTimeout(() => controller.abort(), timeoutMs);
    try {
      const res = await fetch(url, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
          'Referer': 'https://animesalt.cx/',
          'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8'
        },
        signal: controller.signal
      });
      clearTimeout(id);
      if (!res.ok) throw new Error(`HTTP ${res.status}: ${res.statusText}`);
      return await res.text();
    } catch (err) {
      clearTimeout(id);
      if (attempt === retries) throw err;
      await delay(1000 * attempt);
    }
  }
}

async function fetchTMDBArt(query, type) {
  try {
    const clean = query
      .replace(/\(.*\)/g, '')
      .replace(/\[.*\]/g, '')
      .replace(/season \d+/gi, '')
      .replace(/dubbed|dub|sub|hindi|urdu|movie/gi, '')
      .trim();

    const encoded = encodeURIComponent(clean);
    const tvUrl = `https://api.themoviedb.org/3/search/tv?api_key=${TMDB_KEY}&query=${encoded}`;
    const movUrl = `https://api.themoviedb.org/3/search/movie?api_key=${TMDB_KEY}&query=${encoded}`;

    const [tvRes, movRes] = await Promise.all([
      fetch(tvUrl).then(r => r.json()).catch(() => ({ results: [] })),
      fetch(movUrl).then(r => r.json()).catch(() => ({ results: [] }))
    ]);

    const results = [...(tvRes.results || []), ...(movRes.results || [])].filter(x => x && (x.poster_path || x.backdrop_path));
    if (results.length > 0) {
      results.sort((a, b) => (b.popularity || 0) - (a.popularity || 0));
      const best = results[0];
      return {
        poster: best.poster_path ? `https://image.tmdb.org/t/p/w500${best.poster_path}` : '',
        backdrop: best.backdrop_path ? `https://image.tmdb.org/t/p/original${best.backdrop_path}` : '',
        overview: best.overview || '',
        rating: best.vote_average ? Math.round(best.vote_average * 10) / 10 : null,
        year: (best.release_date || best.first_air_date || '').split('-')[0] ? parseInt((best.release_date || best.first_air_date || '').split('-')[0], 10) : null
      };
    }
  } catch (e) {}
  return null;
}

async function fetchAnilistMetadata(title) {
  const query = `
    query ($search: String) {
      Media (search: $search, type: ANIME) {
        id
        title {
          romaji
          english
          native
        }
        coverImage {
          extraLarge
          large
        }
        bannerImage
        description
        averageScore
        seasonYear
        season
        status
        genres
      }
    }
  `;

  try {
    const searchClean = title
      .replace(/\(.*\)/g, '')
      .replace(/\[.*\]/g, '')
      .replace(/season \d+/gi, '')
      .replace(/dubbed|dub|sub|hindi|urdu|movie/gi, '')
      .trim();

    const res = await fetch('https://graphql.anilist.co', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
      },
      body: JSON.stringify({
        query,
        variables: { search: searchClean || title }
      })
    });

    if (res.ok) {
      const json = await res.json();
      const media = json.data?.Media;
      if (media) {
        return {
          id: media.id,
          romajiName: media.title?.romaji || '',
          englishName: media.title?.english || '',
          nativeName: media.title?.native || '',
          description: media.description || '',
          coverImage: media.coverImage?.extraLarge || media.coverImage?.large || '',
          bannerImage: media.bannerImage || '',
          rating: media.averageScore || null,
          year: media.seasonYear || null,
          season: media.season || '',
          status: media.status || '',
          genres: media.genres || []
        };
      }
    }
  } catch (e) {}
  return null;
}

function parseEpisodesFromHtml($, seasonNum = 1) {
  const episodes = [];
  $('article.episodes').each((i, el) => {
    const epLinkEl = $(el).find('a.lnk-blk').first();
    const epHref = epLinkEl.attr('href') || '';
    const epNumRaw = $(el).find('.num-epi').text().trim();
    const epNum = parseInt(epNumRaw, 10) || i + 1;
    let epTitle = $(el).find('.entry-title').text().trim() || `Episode ${epNum}`;
    epTitle = epTitle.replace(/^private:\s*/gi, '').trim();

    const epSlug = epHref.split('/').filter(Boolean).pop() || '';
    let epThumb = $(el).find('figure img, img').first().attr('data-src') ||
                  $(el).find('figure img, img').first().attr('src') || '';
    if (epThumb.startsWith('//')) {
      epThumb = 'https:' + epThumb;
    }

    if (epSlug) {
      episodes.push({
        number: epNum,
        season: seasonNum,
        title: `S${seasonNum} E${epNum}: ${epTitle}`,
        slug: epSlug,
        url: epHref.replace(/^http:\/\//i, 'https://'),
        thumbnail: epThumb
      });
    }
  });
  return episodes;
}

async function scrapeFullSeriesEpisodes(seriesUrl) {
  const allEpisodes = [];
  const html = await fetchWithUA(seriesUrl);
  const $ = cheerio.load(html);

  // Check for season buttons
  const seasonButtons = [];
  $('a.season-btn, .season-btn').each((_, el) => {
    const s = $(el).attr('data-season');
    const p = $(el).attr('data-post');
    if (s && p) {
      seasonButtons.push({ season: parseInt(s, 10), post: p });
    }
  });

  if (seasonButtons.length > 0) {
    for (const sb of seasonButtons) {
      try {
        const ajaxUrl = `https://animesalt.cx/wp-admin/admin-ajax.php?action=action_select_season&season=${sb.season}&post=${sb.post}`;
        const ajaxHtml = await fetchWithUA(ajaxUrl);
        const $ajax = cheerio.load(ajaxHtml);
        const sEps = parseEpisodesFromHtml($ajax, sb.season);
        if (sEps.length > 0) {
          allEpisodes.push(...sEps);
        }
      } catch (err) {
        console.warn(`  [!] Failed AJAX for season ${sb.season}:`, err.message);
      }
      await delay(150);
    }
  }

  // Fallback to direct HTML if no season buttons or AJAX yielded nothing
  if (allEpisodes.length === 0) {
    const directEps = parseEpisodesFromHtml($, 1);
    allEpisodes.push(...directEps);
  }

  // Deduplicate and sort by season, then episode number
  const uniqueEpsMap = new Map();
  for (const ep of allEpisodes) {
    const key = `${ep.season}-${ep.number}-${ep.slug}`;
    if (!uniqueEpsMap.has(key)) {
      uniqueEpsMap.set(key, ep);
    }
  }

  const finalEpisodes = Array.from(uniqueEpsMap.values());
  finalEpisodes.sort((a, b) => {
    if (a.season !== b.season) return a.season - b.season;
    return a.number - b.number;
  });

  return { html, $, episodes: finalEpisodes };
}

async function scrapeMovieDetails(movieUrl) {
  const html = await fetchWithUA(movieUrl);
  const $ = cheerio.load(html);

  const title = $('h1').first().text().trim() || $('.entry-title').first().text().trim();
  const description = $('.entry-content p, #description p, .synopsis p').first().text().trim() ||
                      $('.entry-content').first().text().trim() || '';

  const genres = [];
  $('a[href*="/category/genre/"], a[href*="/genre/"]').each((_, el) => {
    const t = $(el).text().trim();
    if (t && !genres.includes(t)) genres.push(t);
  });

  const audioLanguages = [];
  $('a[href*="/category/language/"], a[href*="/language/"]').each((_, el) => {
    const t = $(el).text().trim();
    if (t && !audioLanguages.includes(t)) audioLanguages.push(t);
  });

  const posterImg = $('.post-thumbnail img, .poster img').first().attr('src') || '';
  const backdropImg = $('.TPostBg').first().attr('src') || '';

  return { html, $, title, description, genres, audioLanguages, posterImg, backdropImg };
}

async function main() {
  console.log('=== DISCOVERING & SCRAPING NEW TITLES & EPISODES FROM ANIMESALT.CX ===\n');

  const db = JSON.parse(fs.readFileSync(DB_PATH, 'utf8'));
  console.log(`Loaded local database: ${db.length} entries.`);

  // Create lookup maps for rapid matching
  const slugMap = new Map();
  const titleMap = new Map();

  const normalize = (str) => (str || '').toLowerCase().replace(/[^a-z0-9]/g, '');

  db.forEach((item, idx) => {
    if (item.slug) slugMap.set(item.slug.toLowerCase().trim(), idx);
    if (item.saltSlug) slugMap.set(item.saltSlug.toLowerCase().trim(), idx);
    if (item.title) titleMap.set(normalize(item.title), idx);
  });

  // Pages to crawl
  const crawlUrls = [
    { url: 'https://animesalt.cx/', type: 'home' },
    { url: 'https://animesalt.cx/series/', type: 'series' },
    { url: 'https://animesalt.cx/series/page/2/', type: 'series' },
    { url: 'https://animesalt.cx/series/page/3/', type: 'series' },
    { url: 'https://animesalt.cx/movies/', type: 'movie' },
    { url: 'https://animesalt.cx/movies/page/2/', type: 'movie' }
  ];

  const discoveredSeries = new Map(); // slug -> { title, url, type }
  const discoveredMovies = new Map(); // slug -> { title, url, type }
  const updatedSeriesFromHome = new Set(); // slugs of series that appear in the latest episode feed

  for (const page of crawlUrls) {
    console.log(`Scanning: ${page.url}...`);
    try {
      const html = await fetchWithUA(page.url);
      const $ = cheerio.load(html);

      // 1. If homepage, extract recent episode links
      if (page.type === 'home') {
        $('article.episodes, .episodes article, .post-episode, article').each((_, el) => {
          const a = $(el).find('a.lnk-blk, a[href*="/series/"], a[href*="/episode/"]').first();
          const href = a.attr('href') || '';
          const title = $(el).find('.entry-title, .title, h2, h3').text().trim();

          // If it's a series link
          if (href.includes('/series/')) {
            const sSlug = href.split('/series/')[1]?.replace(/\/+$/, '');
            if (sSlug) {
              discoveredSeries.set(sSlug, { title, url: href, type: 'series' });
              updatedSeriesFromHome.add(sSlug);
            }
          } else if (href.includes('/episode/')) {
            // Episode format: /episode/slug-seasonxepisode/
            const epPart = href.split('/episode/')[1]?.replace(/\/+$/, '');
            if (epPart) {
              // Extract series base slug by stripping -seasonXepisode or similar
              const seriesSlugGuess = epPart.replace(/-\d+x\d+$/i, '').replace(/-season-\d+.*$/i, '');
              if (seriesSlugGuess) {
                updatedSeriesFromHome.add(seriesSlugGuess);
                const seriesUrl = `https://animesalt.cx/series/${seriesSlugGuess}/`;
                discoveredSeries.set(seriesSlugGuess, { title: title || seriesSlugGuess, url: seriesUrl, type: 'series' });
              }
            }
          }
        });
      }

      // 2. Series listings
      if (page.type === 'series') {
        $('article').each((_, el) => {
          const a = $(el).find('a').first();
          const href = a.attr('href') || '';
          const title = $(el).find('.entry-title, .title, h2, h3').first().text().trim();
          if (href.includes('/series/')) {
            const sSlug = href.split('/series/')[1]?.replace(/\/+$/, '');
            if (sSlug) {
              discoveredSeries.set(sSlug, { title: title || sSlug, url: href, type: 'series' });
            }
          }
        });
      }

      // 3. Movies listings
      if (page.type === 'movie') {
        $('article').each((_, el) => {
          const a = $(el).find('a').first();
          const href = a.attr('href') || '';
          const title = $(el).find('.entry-title, .title, h2, h3').first().text().trim();
          if (href.includes('/movies/')) {
            const mSlug = href.split('/movies/')[1]?.replace(/\/+$/, '');
            if (mSlug) {
              discoveredMovies.set(mSlug, { title: title || mSlug, url: href, type: 'movie' });
            }
          }
        });
      }

      await delay(200);
    } catch (err) {
      console.warn(`Failed scanning ${page.url}:`, err.message);
    }
  }

  console.log(`\nDiscovered from AnimeSalt:`);
  console.log(`- Unique Series: ${discoveredSeries.size}`);
  console.log(`- Unique Movies: ${discoveredMovies.size}`);
  console.log(`- Series with Recent Episodes: ${updatedSeriesFromHome.size}\n`);

  let newTitlesAdded = 0;
  let seriesEpisodesUpdated = 0;
  let totalNewEpisodes = 0;

  // ── PHASE 1: Add brand NEW Series ──────────────────────────────────────────
  console.log('=== PHASE 1: Checking for NEW Series ===');
  for (const [sSlug, sData] of discoveredSeries.entries()) {
    const existingIdx = slugMap.get(sSlug.toLowerCase()) ?? titleMap.get(normalize(sData.title));
    if (existingIdx !== undefined) {
      continue; // Already in DB, will check for new episodes in Phase 2
    }

    console.log(`\n✨ [NEW SERIES DISCOVERED] "${sData.title}" (${sData.url})`);
    try {
      const { html, $, episodes } = await scrapeFullSeriesEpisodes(sData.url);
      const title = $('h1').first().text().trim() || $('.entry-title').first().text().trim() || sData.title;
      const description = $('.entry-content p, #description p, .synopsis p').first().text().trim() ||
                          $('.entry-content').first().text().trim() || '';

      const genres = [];
      $('a[href*="/category/genre/"], a[href*="/genre/"]').each((_, el) => {
        const t = $(el).text().trim();
        if (t && !genres.includes(t)) genres.push(t);
      });

      const audioLanguages = [];
      $('a[href*="/category/language/"], a[href*="/language/"]').each((_, el) => {
        const t = $(el).text().trim();
        if (t && !audioLanguages.includes(t)) audioLanguages.push(t);
      });

      console.log(`  Scraped ${episodes.length} episodes for "${title}"`);
      console.log('  Enriching with TMDB and AniList art...');
      const tmdbArt = await fetchTMDBArt(title, 'series');
      const anilistData = await fetchAnilistMetadata(title);

      const poster = tmdbArt?.poster || anilistData?.coverImage || $('.post-thumbnail img, .poster img').first().attr('src') || '';
      const backdrop = tmdbArt?.backdrop || anilistData?.bannerImage || $('.TPostBg').first().attr('src') || poster;

      const newItem = {
        title,
        slug: sSlug,
        saltSlug: sSlug,
        url: sData.url,
        type: 'series',
        poster: poster.startsWith('//') ? 'https:' + poster : poster,
        backdrop: backdrop.startsWith('//') ? 'https:' + backdrop : backdrop,
        description: tmdbArt?.overview || anilistData?.description || description,
        genres: genres.length > 0 ? genres : (anilistData?.genres?.length ? anilistData.genres : ['Action', 'Adventure']),
        audioLanguages: audioLanguages.length > 0 ? audioLanguages : ['Hindi', 'Urdu', 'Japanese'],
        rating: tmdbArt?.rating || (anilistData?.rating ? anilistData.rating / 10 : 8.2),
        year: tmdbArt?.year || anilistData?.year || 2024,
        episodes,
        anilist: anilistData || null,
        source: 'animesalt'
      };

      db.unshift(newItem); // Newest items placed at the front!
      slugMap.set(sSlug.toLowerCase(), 0);
      titleMap.set(normalize(title), 0);
      newTitlesAdded++;
      totalNewEpisodes += episodes.length;
      console.log(`  ✓ Successfully added new series "${title}" with ${episodes.length} episodes!`);
    } catch (err) {
      console.error(`  ✗ Error adding series "${sData.title}":`, err.message);
    }
    await delay(300);
  }

  // ── PHASE 2: Add brand NEW Movies ──────────────────────────────────────────
  console.log('\n=== PHASE 2: Checking for NEW Movies ===');
  for (const [mSlug, mData] of discoveredMovies.entries()) {
    const existingIdx = slugMap.get(mSlug.toLowerCase()) ?? titleMap.get(normalize(mData.title));
    if (existingIdx !== undefined) {
      continue;
    }

    console.log(`\n✨ [NEW MOVIE DISCOVERED] "${mData.title}" (${mData.url})`);
    try {
      const details = await scrapeMovieDetails(mData.url);
      const title = details.title || mData.title;

      console.log('  Enriching movie with TMDB and AniList...');
      const tmdbArt = await fetchTMDBArt(title, 'movie');
      const anilistData = await fetchAnilistMetadata(title);

      const poster = tmdbArt?.poster || anilistData?.coverImage || details.posterImg || '';
      const backdrop = tmdbArt?.backdrop || anilistData?.bannerImage || details.backdropImg || poster;

      const newMov = {
        title,
        slug: mSlug,
        saltSlug: mSlug,
        url: mData.url,
        type: 'movie',
        poster: poster.startsWith('//') ? 'https:' + poster : poster,
        backdrop: backdrop.startsWith('//') ? 'https:' + backdrop : backdrop,
        description: tmdbArt?.overview || anilistData?.description || details.description,
        genres: details.genres.length > 0 ? details.genres : (anilistData?.genres?.length ? anilistData.genres : ['Anime', 'Movie']),
        audioLanguages: details.audioLanguages.length > 0 ? details.audioLanguages : ['Hindi', 'Urdu', 'Japanese'],
        rating: tmdbArt?.rating || (anilistData?.rating ? anilistData.rating / 10 : 8.0),
        year: tmdbArt?.year || anilistData?.year || 2024,
        episodes: [
          {
            number: 1,
            season: 1,
            title: 'Full Movie',
            slug: `${mSlug}-movie`,
            url: mData.url,
            thumbnail: backdrop || poster
          }
        ],
        anilist: anilistData || null,
        source: 'animesalt'
      };

      db.unshift(newMov);
      slugMap.set(mSlug.toLowerCase(), 0);
      titleMap.set(normalize(title), 0);
      newTitlesAdded++;
      console.log(`  ✓ Successfully added new movie "${title}"!`);
    } catch (err) {
      console.error(`  ✗ Error adding movie "${mData.title}":`, err.message);
    }
    await delay(300);
  }

  // ── PHASE 3: Update Existing Series with Newly Released Episodes ──────────
  console.log('\n=== PHASE 3: Checking Existing Series for Newly Released Episodes ===');

  // Check all series that appeared on homepage or in recent pages
  const seriesToCheck = [];
  for (const [sSlug, sData] of discoveredSeries.entries()) {
    const existingIdx = slugMap.get(sSlug.toLowerCase()) ?? titleMap.get(normalize(sData.title));
    if (existingIdx !== undefined) {
      seriesToCheck.push({ target: sData, dbIndex: existingIdx });
    }
  }

  console.log(`Checking ${seriesToCheck.length} active matching series for episode updates...`);

  for (let i = 0; i < seriesToCheck.length; i++) {
    const { target, dbIndex } = seriesToCheck[i];
    const item = db[dbIndex];
    const previousCount = item.episodes ? item.episodes.length : 0;

    try {
      const { episodes } = await scrapeFullSeriesEpisodes(target.url);
      if (episodes.length > previousCount) {
        // Map existing pre-cached stream URLs
        const existingStreamMap = new Map();
        if (item.episodes) {
          for (const oldEp of item.episodes) {
            if (oldEp.streamUrl) {
              existingStreamMap.set(oldEp.slug, oldEp.streamUrl);
              existingStreamMap.set(`${oldEp.season}-${oldEp.number}`, oldEp.streamUrl);
            }
          }
        }

        // Apply preserved streamUrls
        for (const newEp of episodes) {
          const preserved = existingStreamMap.get(newEp.slug) || existingStreamMap.get(`${newEp.season}-${newEp.number}`);
          if (preserved && !newEp.streamUrl) {
            newEp.streamUrl = preserved;
          }
        }

        const diff = episodes.length - previousCount;
        item.episodes = episodes;
        seriesEpisodesUpdated++;
        totalNewEpisodes += diff;
        console.log(`  ✓ [UPDATED] "${item.title}": ${previousCount} -> ${episodes.length} episodes (+${diff} new episodes!)`);
      }
    } catch (err) {
      // Quiet fail on network hiccups
    }
    await delay(150);
  }

  console.log('\n======================================================');
  console.log('SCRAPE & SYNC RESULTS:');
  console.log(`- New Anime Titles Added: ${newTitlesAdded}`);
  console.log(`- Existing Series Updated: ${seriesEpisodesUpdated}`);
  console.log(`- Total New Episodes Synced: ${totalNewEpisodes}`);
  console.log(`- Total Catalog Items Now: ${db.length}`);
  console.log('======================================================\n');

  // Save to anime-db.json
  fs.writeFileSync(DB_PATH, JSON.stringify(db, null, 2), 'utf8');
  console.log(`💾 Saved updated ${DB_PATH}`);

  // Regenerate anime-catalog.json
  console.log('Regenerating anime-catalog.json for instant frontend loading...');
  const catalog = db.map(item => ({
    id: item.id || item.slug,
    title: item.title,
    slug: item.slug,
    saltSlug: item.saltSlug || item.slug,
    type: item.type || 'series',
    poster: item.poster || '',
    backdrop: item.backdrop || item.poster || '',
    genres: item.genres || ['Anime'],
    rating: item.rating || 8.0,
    year: item.year || 2024,
    episodeCount: item.type === 'movie' ? 1 : (item.episodes ? item.episodes.length : 1),
    source: item.source || 'animesalt'
  }));

  fs.writeFileSync(CATALOG_PATH, JSON.stringify(catalog, null, 2), 'utf8');
  console.log(`💾 Regenerated anime-catalog.json (${catalog.length} items)`);

  console.log('\n🎉 ALL NEW ANIMES AND EPISODES SUCCESSFULLY SCRAPED!');
}

main().catch(console.error);
