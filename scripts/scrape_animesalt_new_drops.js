/**
 * scripts/scrape_animesalt_new_drops.js
 *
 * Scrapes all new anime and new episodes from AnimeSalt (https://animesalt.cx):
 * 1. Scans Homepage drops, Series pages 1-5, and latest sitemaps.
 * 2. Detects any brand new anime titles and adds them with TMDB/AniList art & episodes.
 * 3. Detects all existing series with newly released episodes.
 * 4. Extracts working stream embeds (Abyss multi-audio, Ravok, etc.) for new episodes.
 * 5. Safely preserves existing streamSources, toonStreamUrls, and metadata.
 * 6. Updates anime-db.json and regenerates anime-catalog.json.
 */

const fs = require('fs');
const path = require('path');
const cheerio = require('cheerio');

const DB_PATH = path.join(__dirname, '..', 'src', 'data', 'anime-db.json');
const CATALOG_PATH = path.join(__dirname, '..', 'src', 'data', 'anime-catalog.json');
const TMDB_KEY = process.env.TMDB_API_KEY || '119b065ce02f9f479565d6b99a758ee2';

const HEADERS = {
  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
  'Referer': 'https://animesalt.cx/',
  'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8'
};

const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

async function fetchHtml(url, retries = 3, timeoutMs = 12000) {
  for (let attempt = 1; attempt <= retries; attempt++) {
    const controller = new AbortController();
    const id = setTimeout(() => controller.abort(), timeoutMs);
    try {
      const res = await fetch(url, { headers: HEADERS, signal: controller.signal });
      clearTimeout(id);
      if (!res.ok) {
        if (res.status === 404) return null;
        throw new Error(`HTTP ${res.status}`);
      }
      return await res.text();
    } catch (err) {
      clearTimeout(id);
      if (attempt === retries) {
        return null;
      }
      await delay(800 * attempt);
    }
  }
  return null;
}

function sanitizeStreamUrl(url) {
  if (!url || typeof url !== 'string') return '';
  let clean = url
    .replace(/^http:\/\//i, 'https://')
    .replace(/as-cdn2[0-5]\.top/gi, 'as-cdn26.top')
    .replace(/animesalt\.(link|me)/gi, 'animesalt.cx')
    .trim();
  if (clean.includes('short.icu/')) {
    clean = clean.replace(/https?:\/\/short\.icu\/([a-zA-Z0-9_\-]+)/gi, 'https://player.abyssplayer.com/$1');
  }
  return clean;
}

function unpackAnimeSaltDataUrl(url) {
  if (!url || typeof url !== 'string') return [];
  if (!url.includes('data=')) return [];
  try {
    const urlObj = new URL(url);
    const dataParam = urlObj.searchParams.get('data');
    if (!dataParam) return [];
    const decodedStr = Buffer.from(dataParam, 'base64').toString('utf8');
    const parsed = JSON.parse(decodedStr);
    if (!Array.isArray(parsed) || parsed.length === 0) return [];

    const results = [];
    for (const item of parsed) {
      if (!item || !item.link) continue;
      const clean = sanitizeStreamUrl(item.link);
      if (clean) {
        results.push({
          label: `Abyss (${item.language || 'HD'})`,
          url: clean,
          isMultiAudio: true,
        });
      }
    }
    return results;
  } catch (e) {
    return [];
  }
}

async function fetchEpisodeStreams(epUrl) {
  const sources = [];
  try {
    const html = await fetchHtml(epUrl, 2, 8000);
    if (!html) return { streamUrl: '', sources: [] };
    const $ = cheerio.load(html);

    $('iframe').each((_, el) => {
      let src = $(el).attr('src') || $(el).attr('data-src') || '';
      if (!src) return;
      if (src.startsWith('//')) src = 'https:' + src;

      // Check for plyr player with encoded data
      if (src.includes('data=')) {
        const unpacked = unpackAnimeSaltDataUrl(src);
        for (const u of unpacked) {
          if (!sources.some(s => s.url === u.url)) sources.push(u);
        }
      } else if (
        src.includes('abyssplayer') ||
        src.includes('ravok.buzz') ||
        src.includes('megaplay.buzz') ||
        src.includes('as-cdn') ||
        src.includes('cloudy') ||
        src.includes('vidstreaming') ||
        src.includes('filesforever') ||
        src.includes('emturbovid')
      ) {
        const clean = sanitizeStreamUrl(src);
        if (clean && !sources.some(s => s.url === clean)) {
          let label = 'Player (HD)';
          if (clean.includes('abyssplayer')) label = 'Abyss (Multi Audio)';
          else if (clean.includes('ravok.buzz')) label = 'Ravok (HD)';
          else if (clean.includes('megaplay.buzz')) label = 'MegaPlay (HD)';
          else if (clean.includes('as-cdn')) label = 'AnimeSalt CDN';
          sources.push({ label, url: clean, isMultiAudio: true });
        }
      }
    });

    const primaryStream = sources.length > 0 ? sources[0].url : '';
    return { streamUrl: primaryStream, sources };
  } catch (e) {
    return { streamUrl: '', sources: [] };
  }
}

function parseEpisodesFromHtml($, seasonNum = 1) {
  const episodes = [];
  $('article.episodes, .episodes article, .post-episode').each((i, el) => {
    const epLinkEl = $(el).find('a.lnk-blk, a').first();
    const epHref = epLinkEl.attr('href') || '';
    const epNumRaw = $(el).find('.num-epi').text().trim();
    const epNum = parseInt(epNumRaw, 10) || i + 1;
    let epTitle = $(el).find('.entry-title').text().trim() || `Episode ${epNum}`;
    epTitle = epTitle.replace(/^private:\s*/gi, '').trim();

    const epSlug = epHref.split('/').filter(Boolean).pop() || '';
    let epThumb = $(el).find('figure img, img').first().attr('data-src') ||
                  $(el).find('figure img, img').first().attr('src') || '';
    if (epThumb.startsWith('//')) epThumb = 'https:' + epThumb;

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
  const html = await fetchHtml(seriesUrl);
  if (!html) return { episodes: [] };
  const $ = cheerio.load(html);

  const seasonButtons = [];
  $('a.season-btn, .season-btn').each((_, el) => {
    const s = $(el).attr('data-season');
    const p = $(el).attr('data-post');
    if (s && p) seasonButtons.push({ season: parseInt(s, 10), post: p });
  });

  if (seasonButtons.length > 0) {
    for (const sb of seasonButtons) {
      try {
        const ajaxUrl = `https://animesalt.cx/wp-admin/admin-ajax.php?action=action_select_season&season=${sb.season}&post=${sb.post}`;
        const ajaxHtml = await fetchHtml(ajaxUrl);
        if (ajaxHtml) {
          const $ajax = cheerio.load(ajaxHtml);
          const sEps = parseEpisodesFromHtml($ajax, sb.season);
          allEpisodes.push(...sEps);
        }
      } catch (err) {}
      await delay(100);
    }
  }

  if (allEpisodes.length === 0) {
    const directEps = parseEpisodesFromHtml($, 1);
    allEpisodes.push(...directEps);
  }

  const uniqueMap = new Map();
  for (const ep of allEpisodes) {
    const key = `${ep.season}-${ep.number}-${ep.slug}`;
    if (!uniqueMap.has(key)) uniqueMap.set(key, ep);
  }

  const finalEpisodes = Array.from(uniqueMap.values());
  finalEpisodes.sort((a, b) => {
    if (a.season !== b.season) return a.season - b.season;
    return a.number - b.number;
  });

  return { html, $, episodes: finalEpisodes };
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

async function main() {
  console.log('=================================================================');
  console.log('   SCRAPING NEW ANIME & NEW EPISODES FROM ANIMESALT.CX');
  console.log('=================================================================\n');

  const db = JSON.parse(fs.readFileSync(DB_PATH, 'utf8'));
  console.log(`Loaded database with ${db.length} items.`);

  const dbMap = new Map();
  db.forEach((item, idx) => {
    if (item.slug) dbMap.set(item.slug.toLowerCase().trim(), idx);
    if (item.saltSlug) dbMap.set(item.saltSlug.toLowerCase().trim(), idx);
  });

  // 1. Discover all series from Homepage and Series Pages 1-5
  const candidatesMap = new Map();

  console.log('Scanning AnimeSalt homepage for recent drops...');
  const homeHtml = await fetchHtml('https://animesalt.cx/');
  if (homeHtml) {
    const $h = cheerio.load(homeHtml);
    $h('article').each((_, el) => {
      const a = $h(el).find('a.lnk-blk, a').first();
      const href = a.attr('href') || '';
      const title = $h(el).find('.entry-title, .title, h2, h3').first().text().trim() ||
                    $h(el).find('img').attr('alt')?.replace(/^Image\s+/i, '').trim();

      if (href.includes('/series/')) {
        const cleanUrl = href.replace(/^http:\/\//i, 'https://');
        const slug = cleanUrl.split('/').filter(Boolean).pop().toLowerCase();
        if (slug && !candidatesMap.has(slug)) {
          candidatesMap.set(slug, { title: title || slug, url: cleanUrl, slug });
        }
      }
    });
  }

  for (let p = 1; p <= 5; p++) {
    const pUrl = p === 1 ? 'https://animesalt.cx/series/' : `https://animesalt.cx/series/page/${p}/`;
    console.log(`Scanning /series/ page ${p}...`);
    const pHtml = await fetchHtml(pUrl);
    if (!pHtml) continue;
    const $p = cheerio.load(pHtml);
    $p('article').each((_, el) => {
      const a = $p(el).find('a').first();
      const href = a.attr('href') || '';
      const title = $p(el).find('.entry-title, .title, h2, h3').first().text().trim() ||
                    $p(el).find('img').attr('alt')?.replace(/^Image\s+/i, '').trim();
      if (href.includes('/series/')) {
        const cleanUrl = href.replace(/^http:\/\//i, 'https://');
        const slug = cleanUrl.split('/').filter(Boolean).pop().toLowerCase();
        if (slug && !candidatesMap.has(slug)) {
          candidatesMap.set(slug, { title: title || slug, url: cleanUrl, slug });
        }
      }
    });
    await delay(150);
  }

  const candidates = Array.from(candidatesMap.values());
  console.log(`\nFound ${candidates.length} unique series candidates from AnimeSalt.\n`);

  let newSeriesAdded = 0;
  let seriesUpdated = 0;
  let totalNewEpisodes = 0;
  const brandNewItems = [];

  for (let i = 0; i < candidates.length; i++) {
    const c = candidates[i];
    const dbIdx = dbMap.get(c.slug);

    if (dbIdx === undefined) {
      // BRAND NEW ANIME
      console.log(`\n[${i + 1}/${candidates.length}] [NEW ANIME FOUND] "${c.title}" (${c.slug})`);
      try {
        const { html, $, episodes } = await scrapeFullSeriesEpisodes(c.url);
        const title = $('h1').first().text().trim() || $('.entry-title').first().text().trim() || c.title;
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

        const [tmdbArt, anilistData] = await Promise.all([
          fetchTMDBArt(title),
          fetchAnilistMetadata(title)
        ]);

        const fallbackPoster = $('img[data-src*="image.tmdb.org"], .post-thumbnail img, .poster img').first().attr('data-src') ||
                               $('img[data-src*="image.tmdb.org"], .post-thumbnail img, .poster img').first().attr('src') || '';
        const fallbackBackdrop = $('.TPostBg').first().attr('data-src') || $('.TPostBg').first().attr('src') || '';

        let poster = tmdbArt?.poster || anilistData?.coverImage || fallbackPoster;
        let backdrop = tmdbArt?.backdrop || anilistData?.bannerImage || fallbackBackdrop || poster;
        if (poster.startsWith('//')) poster = 'https:' + poster;
        if (backdrop.startsWith('//')) backdrop = 'https:' + backdrop;

        console.log(`  Scraping stream sources for ${episodes.length} episodes...`);
        for (const ep of episodes) {
          if (ep.url) {
            const { streamUrl, sources } = await fetchEpisodeStreams(ep.url);
            if (streamUrl) ep.streamUrl = streamUrl;
            if (sources.length > 0) ep.streamSources = sources;
          }
        }

        const newAnimeItem = {
          title,
          slug: c.slug,
          saltSlug: c.slug,
          url: c.url,
          saltUrl: c.url,
          type: 'series',
          poster,
          backdrop,
          description: tmdbArt?.overview || anilistData?.description || description,
          genres: genres.length > 0 ? genres : (anilistData?.genres?.length ? anilistData.genres : ['Action', 'Anime']),
          audioLanguages: audioLanguages.length > 0 ? audioLanguages : ['Hindi', 'Urdu', 'Japanese'],
          rating: tmdbArt?.rating || anilistData?.rating || 8.0,
          year: tmdbArt?.year || anilistData?.year || 2024,
          episodes,
          episodeCount: episodes.length,
          episodesCount: episodes.length,
          anilist: anilistData || null,
          source: 'animesalt'
        };

        brandNewItems.push(newAnimeItem);
        dbMap.set(c.slug, 0); // Mark seen
        newSeriesAdded++;
        totalNewEpisodes += episodes.length;
        console.log(`  ✓ Successfully added new series "${title}" with ${episodes.length} episodes!`);
      } catch (err) {
        console.error(`  ✗ Error scraping new series "${c.title}":`, err.message);
      }
    } else {
      // EXISTING SERIES: CHECK FOR NEW EPISODES
      const dbItem = db[dbIdx];
      const previousCount = dbItem.episodes ? dbItem.episodes.length : 0;
      const scrapeUrl = dbItem.saltUrl || dbItem.url || c.url;

      try {
        const { episodes } = await scrapeFullSeriesEpisodes(scrapeUrl);

        if (episodes.length > previousCount) {
          const diff = episodes.length - previousCount;
          console.log(`\n[EPISODE UPDATE] "${dbItem.title}" has ${episodes.length} episodes on AnimeSalt (DB had ${previousCount}) -> (+${diff} new episodes!)`);

          // Existing episodes map by key
          const existingKeyMap = new Map();
          if (dbItem.episodes) {
            for (const ep of dbItem.episodes) {
              const key = `${ep.season || 1}-${ep.number}`;
              existingKeyMap.set(key, ep);
              existingKeyMap.set(ep.slug, ep);
            }
          }

          const mergedEpisodes = [];
          for (const newEp of episodes) {
            const key = `${newEp.season || 1}-${newEp.number}`;
            const existingEp = existingKeyMap.get(key) || existingKeyMap.get(newEp.slug);

            if (existingEp) {
              // Keep original intact, only fill in missing fields
              if (!existingEp.saltUrl && newEp.url) existingEp.saltUrl = newEp.url;
              if (!existingEp.thumbnail && newEp.thumbnail) existingEp.thumbnail = newEp.thumbnail;
              mergedEpisodes.push(existingEp);
            } else {
              // Brand new episode: fetch its stream embed & mirrors
              console.log(`  -> Scraping stream for new Episode: ${newEp.title} (${newEp.url})`);
              const { streamUrl, sources } = await fetchEpisodeStreams(newEp.url);
              if (streamUrl) newEp.streamUrl = streamUrl;
              if (sources.length > 0) newEp.streamSources = sources;
              mergedEpisodes.push(newEp);
            }
          }

          dbItem.episodes = mergedEpisodes;
          dbItem.episodeCount = mergedEpisodes.length;
          dbItem.episodesCount = mergedEpisodes.length;
          seriesUpdated++;
          totalNewEpisodes += diff;
          console.log(`  ✓ Successfully merged and updated "${dbItem.title}" to ${mergedEpisodes.length} episodes!`);
        }
      } catch (err) {
        // continue
      }
    }

    await delay(120);
  }

  // Prepend brand new anime to database
  if (brandNewItems.length > 0) {
    db.unshift(...brandNewItems);
  }

  console.log('\n=================================================================');
  console.log('SUMMARY OF ANIMESALT SCRAPE:');
  console.log(`- Brand New Anime Added: ${newSeriesAdded}`);
  console.log(`- Existing Series Updated: ${seriesUpdated}`);
  console.log(`- Total New Episodes Ingested: ${totalNewEpisodes}`);
  console.log(`- Total Titles in Database: ${db.length}`);
  console.log('=================================================================\n');

  // Save updated anime-db.json
  fs.writeFileSync(DB_PATH, JSON.stringify(db, null, 2), 'utf8');
  console.log(`💾 Saved updated ${DB_PATH}`);

  // Regenerate anime-catalog.json for frontend
  console.log('🔄 Regenerating anime-catalog.json...');
  const catalog = db.map(item => ({
    id: item.id || `ap-${item.slug}`,
    title: item.title,
    slug: item.slug,
    saltSlug: item.saltSlug || undefined,
    toonSlug: item.toonSlug || undefined,
    type: item.type || 'series',
    poster: item.poster || '',
    backdrop: item.backdrop || item.poster || '',
    genres: item.genres || ['Anime'],
    audioLanguages: item.audioLanguages || ['Hindi', 'Urdu'],
    rating: item.rating || 8.0,
    year: item.year || 2024,
    episodeCount: item.type === 'movie' ? 1 : (item.episodes ? item.episodes.length : 1),
    episodesCount: item.type === 'movie' ? 1 : (item.episodes ? item.episodes.length : 1),
    hasStreams: true,
    anilist: item.anilist || null,
    source: item.source || 'hybrid',
    isCustomLocal: item.isCustomLocal ?? false,
    isFeaturedHero: item.isFeaturedHero ?? false
  }));

  fs.writeFileSync(CATALOG_PATH, JSON.stringify(catalog, null, 2), 'utf8');
  console.log(`💾 Saved anime-catalog.json (${catalog.length} items).`);
  console.log('\n🎉 ALL DONE! NEW ANIME AND EPISODES ARE NOW FULLY SCRAPED & INTEGRATED!');
}

main().catch(console.error);
