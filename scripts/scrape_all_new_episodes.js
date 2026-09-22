/**
 * scripts/scrape_all_new_episodes.js
 *
 * Automatically scrapes new episodes and newly added anime series from AnimeSalt,
 * enriches metadata (TMDB/AniList), preserves existing stream URLs,
 * updates anime-db.json, and regenerates anime-catalog.json.
 *
 * Usage:
 *   npm run scrape:new
 *   npm run scrape:new -- https://animesalt.cx/series/example-slug/
 *   npm run scrape:new -- example-slug
 */

const fs = require('fs');
const path = require('path');
const cheerio = require('cheerio');

const DB_PATH = path.join(__dirname, '..', 'src', 'data', 'anime-db.json');
const CATALOG_PATH = path.join(__dirname, '..', 'src', 'data', 'anime-catalog.json');
const TMDB_KEY = process.env.TMDB_API_KEY || '119b065ce02f9f479565d6b99a758ee2';

const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

async function fetchWithUA(url, retries = 3, timeoutMs = 12000) {
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

async function fetchTMDBArt(query) {
  try {
    const clean = query
      .replace(/\(.*\)/g, '')
      .replace(/\[.*\]/g, '')
      .replace(/season \d+/gi, '')
      .replace(/dubbed|dub|sub|hindi|urdu/gi, '')
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
        rating: best.vote_average ? Math.round(best.vote_average * 10) / 10 : 8.0,
        year: best.first_air_date ? parseInt(best.first_air_date.split('-')[0], 10) :
              (best.release_date ? parseInt(best.release_date.split('-')[0], 10) : 2024)
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
        title { romaji english native }
        coverImage { extraLarge large }
        bannerImage
        description
        averageScore
        seasonYear
        genres
      }
    }
  `;

  try {
    const searchClean = title
      .replace(/\(.*\)/g, '')
      .replace(/\[.*\]/g, '')
      .replace(/season \d+/gi, '')
      .replace(/dubbed|dub|sub|hindi|urdu/gi, '')
      .trim();

    const res = await fetch('https://graphql.anilist.co', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
      body: JSON.stringify({ query, variables: { search: searchClean || title } })
    });

    if (res.ok) {
      const json = await res.json();
      const media = json.data?.Media;
      if (media) {
        return {
          id: media.id,
          coverImage: media.coverImage?.extraLarge || media.coverImage?.large || '',
          bannerImage: media.bannerImage || '',
          description: media.description?.replace(/<[^>]*>?/gm, '') || '',
          rating: media.averageScore ? Math.round((media.averageScore / 10) * 10) / 10 : 8.0,
          year: media.seasonYear || 2024,
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
    const epLinkEl = $(el).find('a.lnk-blk, a').first();
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
function isValidStreamEmbed(url) {
  if (!url || typeof url !== 'string') return false;
  const lower = url.toLowerCase().trim();
  if (!lower.startsWith('http://') && !lower.startsWith('https://')) return false;
  if (lower.includes('short.icu') || lower.includes('short.link') || lower.includes('linkvertise')) return false;
  if (lower.includes('animesalt.cx/episode') || lower.includes('animesalt.cx/series') || lower.includes('animesalt.cx/movies')) return false;
  if (lower.includes('google') || lower.includes('doubleclick') || lower.includes('disqus') || lower.includes('facebook') || lower.includes('youtube.com/embed')) return false;
  return true;
}

async function fetchEpisodeStream(epUrl) {
  try {
    const html = await fetchWithUA(epUrl, 2, 8000);
    const $ = cheerio.load(html);
    const candidates = [];
    $('iframe').each((_, el) => {
      const src = $(el).attr('src') || $(el).attr('data-src') || '';
      if (src) {
        const full = src.startsWith('//') ? 'https:' + src : src;
        if (isValidStreamEmbed(full)) candidates.push(full);
      }
    });
    $('[data-player], [data-embed], .playex').each((_, el) => {
      const embed = $(el).attr('data-player') || $(el).attr('data-embed') || $(el).attr('data-src') || '';
      if (embed && isValidStreamEmbed(embed)) {
        candidates.push(embed.startsWith('//') ? 'https:' + embed : embed);
      }
    });
    const asCdn = candidates.find(c => c.includes('as-cdn'));
    if (asCdn) return asCdn.replace(/as-cdn2[0-5]\.top/gi, 'as-cdn26.top');
    const mega = candidates.find(c => c.includes('megaplay.buzz'));
    if (mega) return mega;
    return candidates[0] || null;
  } catch (e) {
    return null;
  }
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
      await delay(120);
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

async function discoverSeriesCandidates() {
  const candidateMap = new Map();

  // 1. AnimeSalt Homepage
  try {
    console.log('Scanning AnimeSalt homepage for latest drops & series...');
    const homeHtml = await fetchWithUA('https://animesalt.cx/');
    const $ = cheerio.load(homeHtml);

    $('section, .widget, .items').each((_, sec) => {
      const secTitle = $(sec).find('h1, h2, h3, .widget-title').first().text().trim();
      $(sec).find('article').each((_, el) => {
        const link = $(el).find('a.lnk-blk, a').first().attr('href') || '';
        const title = $(el).find('.entry-title, .title, h2, h3').first().text().trim() ||
                      $(el).find('img').attr('alt')?.replace(/^Image\s+/i, '').trim();

        if (link && link.includes('/series/')) {
          const cleanUrl = link.replace(/^http:\/\//i, 'https://');
          const slug = cleanUrl.split('/').filter(Boolean).pop().toLowerCase();
          if (slug && !candidateMap.has(slug)) {
            candidateMap.set(slug, {
              title: title || slug,
              url: cleanUrl,
              slug,
              source: secTitle || 'Homepage Drops'
            });
          }
        }
      });
    });
  } catch (err) {
    console.warn('[!] Failed to scan homepage:', err.message);
  }

  // 2. AnimeSalt /series/ pages (pages 1 to 3)
  for (let p = 1; p <= 3; p++) {
    try {
      const pageUrl = p === 1 ? 'https://animesalt.cx/series/' : `https://animesalt.cx/series/page/${p}/`;
      const sHtml = await fetchWithUA(pageUrl);
      const $s = cheerio.load(sHtml);
      $s('article').each((_, el) => {
        const link = $s(el).find('a').first().attr('href') || '';
        const title = $s(el).find('.entry-title, h2, h3').first().text().trim() ||
                      $s(el).find('img').attr('alt')?.replace(/^Image\s+/i, '').trim();

        if (link && link.includes('/series/')) {
          const cleanUrl = link.replace(/^http:\/\//i, 'https://');
          const slug = cleanUrl.split('/').filter(Boolean).pop().toLowerCase();
          if (slug && !candidateMap.has(slug)) {
            candidateMap.set(slug, {
              title: title || slug,
              url: cleanUrl,
              slug,
              source: `Series Catalog (Page ${p})`
            });
          }
        }
      });
      await delay(120);
    } catch (err) {
      console.warn(`[!] Failed to scan /series/ page ${p}:`, err.message);
    }
  }

  return Array.from(candidateMap.values());
}

function findDbItem(db, slug) {
  const s = slug.toLowerCase().trim();
  return db.find(x =>
    (x.slug && x.slug.toLowerCase().trim() === s) ||
    (x.saltSlug && x.saltSlug.toLowerCase().trim() === s) ||
    (x.url && x.url.toLowerCase().includes(`/series/${s}/`))
  );
}

async function main() {
  console.log('===========================================================');
  console.log('   ANIMESALT AUTOMATIC EPISODE & SERIES SCRAPER');
  console.log('===========================================================\n');

  if (!fs.existsSync(DB_PATH)) {
    console.error('Database file not found at:', DB_PATH);
    process.exit(1);
  }

  const db = JSON.parse(fs.readFileSync(DB_PATH, 'utf8'));
  console.log(`Loaded database with ${db.length} items.\n`);

  // Check if specific target was passed via CLI arguments
  const args = process.argv.slice(2).filter(a => !a.startsWith('--'));
  let candidates = [];

  if (args.length > 0) {
    const rawTarget = args[0].trim();
    let targetSlug = rawTarget.replace(/^https?:\/\/animesalt\.cx\/series\//i, '').replace(/\/+$/, '').toLowerCase();
    let targetUrl = rawTarget.startsWith('http') ? rawTarget : `https://animesalt.cx/series/${targetSlug}/`;
    console.log(`[Targeted Mode] Scraping specific requested series: ${targetSlug}`);
    candidates = [{ title: targetSlug, slug: targetSlug, url: targetUrl, source: 'CLI Argument' }];
  } else {
    // Dynamic discovery mode
    candidates = await discoverSeriesCandidates();
    console.log(`Found ${candidates.length} series candidates to evaluate from AnimeSalt.\n`);
  }

  const newlyAddedItems = [];
  let totalNewEpisodesAdded = 0;
  let updatedSeriesCount = 0;

  for (let i = 0; i < candidates.length; i++) {
    const candidate = candidates[i];
    const dbItem = findDbItem(db, candidate.slug);

    if (!dbItem) {
      // ----------------- BRAND NEW SERIES -----------------
      console.log(`[${i + 1}/${candidates.length}] [NEW ANIME FOUND] "${candidate.title}" (${candidate.slug})`);
      try {
        const { html, $, episodes } = await scrapeFullSeriesEpisodes(candidate.url);
        const title = $('h1').first().text().trim() || $('.entry-title').first().text().trim() || candidate.title;
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

        // High-res images from TMDB or AniList
        const [tmdbArt, anilistData] = await Promise.all([
          fetchTMDBArt(title),
          fetchAnilistMetadata(title)
        ]);

        // Fallback images from AnimeSalt embedded data attributes
        const fallbackPoster = $('img[data-src*="image.tmdb.org"], .post-thumbnail img, .poster img').first().attr('data-src') ||
                               $('img[data-src*="image.tmdb.org"], .post-thumbnail img, .poster img').first().attr('src') || '';
        const fallbackBackdrop = $('.TPostBg').first().attr('data-src') || $('.TPostBg').first().attr('src') || '';

        let poster = tmdbArt?.poster || anilistData?.coverImage || fallbackPoster;
        let backdrop = tmdbArt?.backdrop || anilistData?.bannerImage || fallbackBackdrop || poster;

        if (poster.startsWith('//')) poster = 'https:' + poster;
        if (backdrop.startsWith('//')) backdrop = 'https:' + backdrop;

        const newAnimeItem = {
          title,
          slug: candidate.slug,
          saltSlug: candidate.slug,
          url: candidate.url,
          type: 'series',
          poster,
          backdrop,
          description: tmdbArt?.overview || anilistData?.description || description,
          genres: genres.length > 0 ? genres : (anilistData?.genres?.length ? anilistData.genres : ['Action', 'Anime']),
          audioLanguages: audioLanguages.length > 0 ? audioLanguages : ['Hindi', 'Urdu', 'English', 'Japanese'],
          rating: tmdbArt?.rating || anilistData?.rating || 8.0,
          year: tmdbArt?.year || anilistData?.year || 2024,
          episodes,
          source: 'animesalt'
        };

        for (const ep of episodes) {
          if (!ep.streamUrl && ep.url) {
            try {
              const stream = await fetchEpisodeStream(ep.url);
              if (stream) ep.streamUrl = stream;
            } catch (e) {}
          }
        }

        newlyAddedItems.push(newAnimeItem);
        totalNewEpisodesAdded += episodes.length;

        console.log(`  ✓ Successfully prepared brand new series: "${title}" with ${episodes.length} episodes!`);
      } catch (err) {
        console.error(`  ✗ Failed scraping new series "${candidate.title}":`, err.message);
      }
    } else {
      // ----------------- EXISTING SERIES: CHECK FOR NEW EPISODES -----------------
      const previousCount = dbItem.episodes ? dbItem.episodes.length : 0;
      const targetScrapeUrl = dbItem.url || candidate.url;

      try {
        const { episodes } = await scrapeFullSeriesEpisodes(targetScrapeUrl);

        if (episodes.length > previousCount) {
          // Preserve existing streams
          const existingStreamMap = new Map();
          if (dbItem.episodes) {
            for (const oldEp of dbItem.episodes) {
              if (oldEp.streamUrl) {
                existingStreamMap.set(oldEp.slug, oldEp.streamUrl);
                existingStreamMap.set(`${oldEp.season}-${oldEp.number}`, oldEp.streamUrl);
              }
            }
          }

          for (const newEp of episodes) {
            const preserved = existingStreamMap.get(newEp.slug) || existingStreamMap.get(`${newEp.season}-${newEp.number}`);
            if (preserved) {
              newEp.streamUrl = preserved;
            } else if (!newEp.streamUrl && newEp.url) {
              try {
                const fetchedStream = await fetchEpisodeStream(newEp.url);
                if (fetchedStream) newEp.streamUrl = fetchedStream;
              } catch (e) {}
            }
          }

          const diff = episodes.length - previousCount;
          dbItem.episodes = episodes;
          totalNewEpisodesAdded += diff;
          updatedSeriesCount++;

          console.log(`  ✓ Updated "${dbItem.title}": ${previousCount} -> ${episodes.length} episodes (+${diff} new episodes)`);
        }
      } catch (err) {
        // Continue with others
      }
    }

    await delay(120);
  }

  // Prepend newly added series to database so they appear first
  if (newlyAddedItems.length > 0) {
    db.unshift(...newlyAddedItems);
  }

  console.log('\n===========================================================');
  console.log('SCRAPE & SYNC COMPLETED');
  console.log(`- Brand New Series Added: ${newlyAddedItems.length}`);
  console.log(`- Existing Series Updated: ${updatedSeriesCount}`);
  console.log(`- Total New Episodes Synced: ${totalNewEpisodesAdded}`);
  console.log('===========================================================\n');

  // Save anime-db.json
  fs.writeFileSync(DB_PATH, JSON.stringify(db, null, 2), 'utf8');
  console.log(`💾 Saved updated ${DB_PATH} (${db.length} total series & movies)`);

  // Regenerate anime-catalog.json
  console.log('🔄 Regenerating anime-catalog.json...');
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

  console.log('\n🎉 ALL NEW EPISODES AND SERIES ARE NOW IN SYNC!');
}

main().catch(console.error);
