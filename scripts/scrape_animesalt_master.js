/**
 * scripts/scrape_animesalt_master.js
 *
 * Master Scraper for AnimeSalt (https://animesalt.cx):
 * 1. Discovers all Anime, Cartoons, Series, and Movies across all Sitemaps and Categories.
 * 2. Scrapes full metadata (Title, Synopses, High-Res Posters, Backdrops, Genres, Audio Languages, Year, Rating).
 * 3. Scrapes all seasons & episodes with thumbnails, titles, and episode numbers.
 * 4. Extracts stream player sources (multi-audio player and mirror servers).
 * 5. Uses resumable JSON caches (scripts/animesalt_catalog_cache.json & scripts/animesalt_scraped_data.json).
 * 6. Merges data seamlessly into src/data/anime-db.json and regenerates src/data/anime-catalog.json.
 *
 * Usage:
 *   node scripts/scrape_animesalt_master.js              # Runs full pipeline
 *   node scripts/scrape_animesalt_master.js --discover   # Only fetch catalog sitemaps
 *   node scripts/scrape_animesalt_master.js --limit=20   # Scrape first 20 items (for testing)
 *   node scripts/scrape_animesalt_master.js --merge-only # Merge already scraped cache into DB
 */

const fs = require('fs');
const path = require('path');
const cheerio = require('cheerio');

const DB_PATH = path.join(__dirname, '..', 'src', 'data', 'anime-db.json');
const CATALOG_PATH = path.join(__dirname, '..', 'src', 'data', 'anime-catalog.json');
const SITEMAP_CACHE_PATH = path.join(__dirname, 'animesalt_catalog_cache.json');
const SCRAPED_DATA_PATH = path.join(__dirname, 'animesalt_scraped_data.json');

const HEADERS = {
  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36',
  'Referer': 'https://animesalt.cx/',
  'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8'
};

const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

// CLI Arguments
const args = process.argv.slice(2);
const DISCOVER_ONLY = args.includes('--discover');
const MERGE_ONLY = args.includes('--merge-only');
const LIMIT_ARG = args.find((a) => a.startsWith('--limit='));
const LIMIT = LIMIT_ARG ? parseInt(LIMIT_ARG.split('=')[1], 10) : Infinity;

async function fetchHtml(url, retries = 3, timeoutMs = 15000) {
  for (let attempt = 1; attempt <= retries; attempt++) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    try {
      const res = await fetch(url, {
        headers: HEADERS,
        signal: controller.signal
      });
      clearTimeout(timer);
      if (!res.ok) {
        if (res.status === 404) return null;
        throw new Error(`HTTP ${res.status}`);
      }
      return await res.text();
    } catch (err) {
      clearTimeout(timer);
      if (attempt === retries) {
        console.warn(`  [!] Failed to fetch ${url}: ${err.message}`);
        return null;
      }
      await delay(1000 * attempt);
    }
  }
  return null;
}

function normalizeTitle(str) {
  return (str || '')
    .toLowerCase()
    .replace(/\b(season\s*\d+|part\s*\d+|s\d+|cour\s*\d+|dub|dubbed|sub|subbed|hindi|urdu|tamil|telugu|movie)\b/gi, '')
    .replace(/[^a-z0-9]/g, '')
    .trim();
}

/**
 * Step 1: Discover all shows & movies from AnimeSalt sitemaps and category archives
 */
async function discoverAllTitles() {
  console.log('=== Step 1: Discovering all titles on AnimeSalt.cx ===');

  const sitemapUrls = [
    { url: 'https://animesalt.cx/movies-sitemap1.xml', type: 'movie' },
    { url: 'https://animesalt.cx/movies-sitemap2.xml', type: 'movie' },
    { url: 'https://animesalt.cx/series-sitemap1.xml', type: 'series' },
    { url: 'https://animesalt.cx/series-sitemap2.xml', type: 'series' },
    { url: 'https://animesalt.cx/series-sitemap3.xml', type: 'series' }
  ];

  const itemsMap = new Map();

  for (const sm of sitemapUrls) {
    console.log(`Fetching sitemap: ${sm.url}`);
    const xml = await fetchHtml(sm.url);
    if (!xml) continue;

    const $ = cheerio.load(xml, { xmlMode: true });
    let count = 0;
    $('loc').each((_, el) => {
      const url = $(el).text().trim();
      const slugMatch = url.match(/\/(series|movies)\/([^/?\s]+)/);
      if (!slugMatch) return;
      const type = slugMatch[1] === 'movies' ? 'movie' : 'series';
      const slug = slugMatch[2].replace(/\/+$/, '').toLowerCase();
      if (!slug || slug === 'series' || slug === 'movies') return;

      if (!itemsMap.has(slug)) {
        itemsMap.set(slug, {
          slug,
          type,
          url: url.endsWith('/') ? url : url + '/'
        });
        count++;
      }
    });
    console.log(`  -> Found ${count} entries in ${path.basename(sm.url)}`);
  }

  // Also check category listings for cartoons/kids in case any are omitted from sitemaps
  const extraCategories = [
    'https://animesalt.cx/category/cartoon/',
    'https://animesalt.cx/category/kids/',
    'https://animesalt.cx/category/animation/'
  ];

  for (const catUrl of extraCategories) {
    const html = await fetchHtml(catUrl);
    if (!html) continue;
    const $ = cheerio.load(html);
    $('a[href*="/series/"], a[href*="/movies/"]').each((_, el) => {
      const href = $(el).attr('href') || '';
      const slugMatch = href.match(/\/(series|movies)\/([^/?\s]+)/);
      if (!slugMatch) return;
      const type = slugMatch[1] === 'movies' ? 'movie' : 'series';
      const slug = slugMatch[2].replace(/\/+$/, '').toLowerCase();
      if (!slug || slug === 'series' || slug === 'movies') return;

      if (!itemsMap.has(slug)) {
        const fullUrl = href.startsWith('http') ? href : `https://animesalt.cx${href}`;
        itemsMap.set(slug, {
          slug,
          type,
          url: fullUrl.endsWith('/') ? fullUrl : fullUrl + '/'
        });
      }
    });
  }

  const catalog = Array.from(itemsMap.values());
  console.log(`Total unique titles discovered: ${catalog.length} (${catalog.filter(x => x.type === 'movie').length} movies, ${catalog.filter(x => x.type === 'series').length} series/shows)\n`);

  fs.writeFileSync(SITEMAP_CACHE_PATH, JSON.stringify(catalog, null, 2), 'utf8');
  console.log(`Saved catalog cache to: ${SITEMAP_CACHE_PATH}`);
  return catalog;
}

/**
 * Step 2: Scrape single movie details
 */
async function scrapeMovie(item) {
  const html = await fetchHtml(item.url);
  if (!html) return null;
  const $ = cheerio.load(html);

  const title = $('h1').first().text().trim() ||
                $('.entry-title').first().text().trim() ||
                item.slug.replace(/-/g, ' ');

  const description = $('.entry-content p, #description p, .synopsis p, .description p').first().text().trim() ||
                      $('.entry-content').first().text().trim() || '';

  const genres = [];
  $('a[href*="/category/genre/"], a[href*="/genre/"]').each((_, el) => {
    const t = $(el).text().trim();
    if (t && !genres.includes(t)) genres.push(t);
  });
  if (genres.length === 0) genres.push('Animation', 'Anime');

  const audioLanguages = [];
  $('a[href*="/category/language/"], a[href*="/language/"]').each((_, el) => {
    const t = $(el).text().trim();
    if (t && !audioLanguages.includes(t)) audioLanguages.push(t);
  });
  if (audioLanguages.length === 0) audioLanguages.push('Hindi', 'Japanese');

  let poster = $('.post-thumbnail img, .poster img, figure img').first().attr('data-src') ||
               $('.post-thumbnail img, .poster img, figure img').first().attr('src') || '';
  if (poster.startsWith('//')) poster = 'https:' + poster;

  let backdrop = $('.TPostBg').first().attr('data-src') ||
                 $('.TPostBg').first().attr('src') || poster;
  if (backdrop.startsWith('//')) backdrop = 'https:' + backdrop;

  const yearText = $('.year, .date, [class*="release"]').first().text().trim();
  const yearMatch = yearText.match(/\b(19\d\d|20\d\d)\b/);
  const year = yearMatch ? parseInt(yearMatch[1], 10) : 2024;

  const ratingText = $('.rating, .num-vote, .imdb').first().text().trim();
  const ratingMatch = ratingText.match(/\b\d+(\.\d+)?\b/);
  const rating = ratingMatch ? parseFloat(ratingMatch[0]) : 8.0;

  // Extract movie streams
  const streamSources = [];
  let streamUrl = '';

  $('iframe').each((_, el) => {
    const src = $(el).attr('src') || $(el).attr('data-src') || '';
    if (src && src.startsWith('http') && !src.includes('google') && !src.includes('facebook') && !src.includes('youtube')) {
      streamSources.push({
        label: `AnimeSalt Server ${streamSources.length + 1}`,
        url: src,
        isMultiAudio: true
      });
    }
  });

  if (streamSources.length > 0) {
    streamUrl = streamSources[0].url;
  }

  return {
    title,
    slug: item.slug,
    saltSlug: item.slug,
    url: item.url,
    saltUrl: item.url,
    type: 'movie',
    poster,
    backdrop,
    description,
    genres,
    audioLanguages,
    year,
    rating,
    streamUrl,
    streamSources
  };
}

/**
 * Step 3: Scrape single series details + all seasons & episodes
 */
async function scrapeSeries(item) {
  const html = await fetchHtml(item.url);
  if (!html) return null;
  const $ = cheerio.load(html);

  const title = $('h1').first().text().trim() ||
                $('.entry-title').first().text().trim() ||
                item.slug.replace(/-/g, ' ');

  const description = $('.entry-content p, #description p, .synopsis p, .description p').first().text().trim() ||
                      $('.entry-content').first().text().trim() || '';

  const genres = [];
  $('a[href*="/category/genre/"], a[href*="/genre/"]').each((_, el) => {
    const t = $(el).text().trim();
    if (t && !genres.includes(t)) genres.push(t);
  });
  if (genres.length === 0) genres.push('Animation', 'Anime');

  const audioLanguages = [];
  $('a[href*="/category/language/"], a[href*="/language/"]').each((_, el) => {
    const t = $(el).text().trim();
    if (t && !audioLanguages.includes(t)) audioLanguages.push(t);
  });
  if (audioLanguages.length === 0) audioLanguages.push('Hindi', 'Japanese');

  let poster = $('.post-thumbnail img, .poster img, figure img').first().attr('data-src') ||
               $('.post-thumbnail img, .poster img, figure img').first().attr('src') || '';
  if (poster.startsWith('//')) poster = 'https:' + poster;

  let backdrop = $('.TPostBg').first().attr('data-src') ||
                 $('.TPostBg').first().attr('src') || poster;
  if (backdrop.startsWith('//')) backdrop = 'https:' + backdrop;

  const yearText = $('.year, .date, [class*="release"]').first().text().trim();
  const yearMatch = yearText.match(/\b(19\d\d|20\d\d)\b/);
  const year = yearMatch ? parseInt(yearMatch[1], 10) : 2024;

  const ratingText = $('.rating, .num-vote, .imdb').first().text().trim();
  const ratingMatch = ratingText.match(/\b\d+(\.\d+)?\b/);
  const rating = ratingMatch ? parseFloat(ratingMatch[0]) : 8.0;

  // Discover all seasons
  const seasonButtons = [];
  $('a.season-btn, .season-btn, [data-season]').each((_, el) => {
    const s = $(el).attr('data-season');
    const p = $(el).attr('data-post');
    if (s && p) {
      seasonButtons.push({ season: parseInt(s, 10), post: p });
    }
  });

  const episodes = [];

  function parseEpisodesHtml($root, seasonNum = 1) {
    const eps = [];
    $root('article.episodes, .episodes article, .post-episode, article').each((i, el) => {
      const a = $root(el).find('a.lnk-blk, a[href*="/episode/"]').first();
      const href = a.attr('href') || '';
      if (!href || !href.includes('/episode/')) return;

      const epNumRaw = $root(el).find('.num-epi').text().trim();
      const epNum = parseInt(epNumRaw, 10) || (i + 1);

      let epTitle = $root(el).find('.entry-title').text().trim() || `Episode ${epNum}`;
      epTitle = epTitle.replace(/^private:\s*/gi, '').trim();

      const epSlug = href.split('/').filter(Boolean).pop() || `${item.slug}-${seasonNum}x${epNum}`;

      let thumb = $root(el).find('figure img, img').first().attr('data-src') ||
                  $root(el).find('figure img, img').first().attr('src') || '';
      if (thumb.startsWith('//')) thumb = 'https:' + thumb;

      eps.push({
        number: epNum,
        season: seasonNum,
        title: `S${seasonNum} E${epNum}: ${epTitle}`,
        slug: epSlug,
        url: href.startsWith('http') ? href : `https://animesalt.cx${href}`,
        thumbnail: thumb
      });
    });
    return eps;
  }

  if (seasonButtons.length > 0) {
    for (const sb of seasonButtons) {
      try {
        const ajaxUrl = `https://animesalt.cx/wp-admin/admin-ajax.php?action=action_select_season&season=${sb.season}&post=${sb.post}`;
        const aHtml = await fetchHtml(ajaxUrl);
        if (aHtml) {
          const $a = cheerio.load(aHtml);
          const sEps = parseEpisodesHtml($a, sb.season);
          episodes.push(...sEps);
        }
      } catch (err) {
        // continue
      }
      await delay(80);
    }
  }

  // Fallback to direct page episodes if no season buttons or AJAX returned 0
  if (episodes.length === 0) {
    const directEps = parseEpisodesHtml($, 1);
    episodes.push(...directEps);
  }

  // Deduplicate episodes
  const uniqueEpsMap = new Map();
  for (const ep of episodes) {
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

  return {
    title,
    slug: item.slug,
    saltSlug: item.slug,
    url: item.url,
    saltUrl: item.url,
    type: 'series',
    poster,
    backdrop,
    description,
    genres,
    audioLanguages,
    year,
    rating,
    episodeCount: finalEpisodes.length,
    episodes: finalEpisodes
  };
}

/**
 * Step 4: Batch scraper orchestrator with concurrency and checkpointing
 */
async function scrapeAllCatalog(catalog) {
  console.log(`\n=== Step 2: Scraping Details for ${catalog.length} Items ===`);

  // Load existing scraped data to resume seamlessly
  let scrapedMap = new Map();
  if (fs.existsSync(SCRAPED_DATA_PATH)) {
    try {
      const existing = JSON.parse(fs.readFileSync(SCRAPED_DATA_PATH, 'utf8'));
      if (Array.isArray(existing)) {
        existing.forEach(item => {
          if (item && item.slug) scrapedMap.set(item.slug, item);
        });
      }
      console.log(`Loaded ${scrapedMap.size} previously scraped items from cache. Resuming...`);
    } catch (e) {
      console.warn('Could not parse existing scraped data cache, starting fresh.');
    }
  }

  const pendingItems = catalog.filter(c => !scrapedMap.has(c.slug)).slice(0, LIMIT);
  console.log(`Pending to scrape: ${pendingItems.length} items (limit: ${LIMIT === Infinity ? 'None' : LIMIT}).`);

  const CONCURRENCY = 4;
  let processed = 0;
  let saveCounter = 0;

  async function worker(workerId) {
    while (pendingItems.length > 0) {
      const item = pendingItems.shift();
      if (!item) break;

      try {
        let res = null;
        if (item.type === 'movie') {
          res = await scrapeMovie(item);
        } else {
          res = await scrapeSeries(item);
        }

        if (res) {
          scrapedMap.set(item.slug, res);
          processed++;
          saveCounter++;
          const epsCount = res.episodes ? `${res.episodes.length} eps` : 'movie';
          console.log(`[Worker ${workerId}] (${processed}/${pendingItems.length + processed}) Scraped: ${res.title} (${epsCount})`);
        } else {
          console.warn(`[Worker ${workerId}] Failed to scrape: ${item.slug}`);
        }
      } catch (err) {
        console.error(`[Worker ${workerId}] Error on ${item.slug}:`, err.message);
      }

      // Periodically flush to disk so no work is lost
      if (saveCounter >= 10) {
        saveCounter = 0;
        fs.writeFileSync(SCRAPED_DATA_PATH, JSON.stringify(Array.from(scrapedMap.values()), null, 2), 'utf8');
      }

      await delay(200);
    }
  }

  const workers = Array.from({ length: CONCURRENCY }, (_, i) => worker(i + 1));
  await Promise.all(workers);

  // Final write
  fs.writeFileSync(SCRAPED_DATA_PATH, JSON.stringify(Array.from(scrapedMap.values()), null, 2), 'utf8');
  console.log(`\nCompleted scraping! Total items in cache: ${scrapedMap.size}`);
  return Array.from(scrapedMap.values());
}

/**
 * Step 5: Merge into anime-db.json and regenerate anime-catalog.json
 */
async function mergeIntoDatabase(scrapedItems) {
  console.log('\n=== Step 3: Merging Scraped Data into anime-db.json ===');

  let db = [];
  if (fs.existsSync(DB_PATH)) {
    db = JSON.parse(fs.readFileSync(DB_PATH, 'utf8'));
  }
  console.log(`Current DB contains ${db.length} entries.`);

  const slugMap = new Map();
  const saltSlugMap = new Map();
  const titleMap = new Map();

  db.forEach((entry, idx) => {
    if (entry.slug) slugMap.set(entry.slug.toLowerCase().trim(), idx);
    if (entry.saltSlug) saltSlugMap.set(entry.saltSlug.toLowerCase().trim(), idx);
    if (entry.title) titleMap.set(normalizeTitle(entry.title), idx);
  });

  let updatedCount = 0;
  let addedCount = 0;
  let totalNewEpisodes = 0;

  for (const saltItem of scrapedItems) {
    const sSlug = saltItem.slug.toLowerCase().trim();
    const sTitleNorm = normalizeTitle(saltItem.title);

    let matchIdx = slugMap.get(sSlug);
    if (matchIdx === undefined) matchIdx = saltSlugMap.get(sSlug);
    if (matchIdx === undefined && sTitleNorm) matchIdx = titleMap.get(sTitleNorm);

    if (matchIdx !== undefined) {
      // Existing item: Merge & Enrich
      const existing = db[matchIdx];

      existing.saltSlug = saltItem.slug;
      if (!existing.saltUrl) existing.saltUrl = saltItem.url;
      if (!existing.description && saltItem.description) existing.description = saltItem.description;
      if ((!existing.poster || existing.poster.includes('placeholder')) && saltItem.poster) existing.poster = saltItem.poster;
      if ((!existing.backdrop || existing.backdrop.includes('placeholder')) && saltItem.backdrop) existing.backdrop = saltItem.backdrop;

      // Merge audio languages
      if (saltItem.audioLanguages && saltItem.audioLanguages.length > 0) {
        existing.audioLanguages = Array.from(new Set([...(existing.audioLanguages || []), ...saltItem.audioLanguages]));
      }

      // Merge genres
      if (saltItem.genres && saltItem.genres.length > 0) {
        existing.genres = Array.from(new Set([...(existing.genres || []), ...saltItem.genres]));
      }

      // For Series: merge episodes
      if (saltItem.type === 'series' && saltItem.episodes && saltItem.episodes.length > 0) {
        if (!existing.episodes || existing.episodes.length === 0) {
          existing.episodes = saltItem.episodes;
          totalNewEpisodes += saltItem.episodes.length;
        } else {
          // Map existing episodes by season & number
          const existingEpMap = new Map();
          existing.episodes.forEach(ep => {
            existingEpMap.set(`${ep.season}-${ep.number}`, ep);
          });

          let addedToSeries = 0;
          for (const sEp of saltItem.episodes) {
            const key = `${sEp.season}-${sEp.number}`;
            if (!existingEpMap.has(key)) {
              existing.episodes.push(sEp);
              existingEpMap.set(key, sEp);
              addedToSeries++;
              totalNewEpisodes++;
            } else {
              // Enrich existing episode with AnimeSalt metadata / link
              const targetEp = existingEpMap.get(key);
              if (!targetEp.saltUrl) targetEp.saltUrl = sEp.url;
              if (!targetEp.thumbnail && sEp.thumbnail) targetEp.thumbnail = sEp.thumbnail;
            }
          }
          if (addedToSeries > 0) {
            existing.episodes.sort((a, b) => {
              if (a.season !== b.season) return a.season - b.season;
              return a.number - b.number;
            });
          }
        }
        existing.episodeCount = existing.episodes.length;
        existing.episodesCount = existing.episodes.length;
      }

      // For Movie: merge stream if existing has none
      if (saltItem.type === 'movie') {
        if (!existing.streamUrl && saltItem.streamUrl) existing.streamUrl = saltItem.streamUrl;
        if ((!existing.streamSources || existing.streamSources.length === 0) && saltItem.streamSources) {
          existing.streamSources = saltItem.streamSources;
        }
      }

      updatedCount++;
    } else {
      // Brand new item: Add to DB
      const newItem = {
        title: saltItem.title,
        slug: saltItem.slug,
        saltSlug: saltItem.slug,
        url: saltItem.url,
        saltUrl: saltItem.url,
        type: saltItem.type,
        poster: saltItem.poster,
        backdrop: saltItem.backdrop,
        description: saltItem.description,
        genres: saltItem.genres,
        audioLanguages: saltItem.audioLanguages,
        rating: saltItem.rating,
        year: saltItem.year,
        episodes: saltItem.episodes || [],
        episodeCount: saltItem.episodes ? saltItem.episodes.length : (saltItem.type === 'movie' ? 1 : 0),
        episodesCount: saltItem.episodes ? saltItem.episodes.length : (saltItem.type === 'movie' ? 1 : 0),
        streamUrl: saltItem.streamUrl || '',
        streamSources: saltItem.streamSources || [],
        source: 'animesalt'
      };

      if (saltItem.episodes) totalNewEpisodes += saltItem.episodes.length;
      db.push(newItem);
      addedCount++;
    }
  }

  console.log(`\nMerge Summary:`);
  console.log(`- Updated existing DB items: ${updatedCount}`);
  console.log(`- Added brand new titles: ${addedCount}`);
  console.log(`- New episodes added across DB: ${totalNewEpisodes}`);
  console.log(`- Total titles in DB now: ${db.length}`);

  // Save anime-db.json
  fs.writeFileSync(DB_PATH, JSON.stringify(db, null, 2), 'utf8');
  console.log(`Saved database to: ${DB_PATH}`);

  // Regenerate anime-catalog.json for frontend
  console.log('\nRegenerating anime-catalog.json for instant frontend loading...');
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
    hasStreams: item.type === 'movie'
      ? !!(item.streamUrl || (item.streamSources && item.streamSources.length > 0))
      : (item.episodes?.some(e => !!(e.streamUrl || (e.streamSources && e.streamSources.length > 0))) ?? false),
    source: item.source || 'hybrid'
  }));

  fs.writeFileSync(CATALOG_PATH, JSON.stringify(catalog, null, 2), 'utf8');
  console.log(`Saved anime-catalog.json (${catalog.length} items).`);
}

/**
 * Main Execution Flow
 */
async function main() {
  console.log('='.repeat(65));
  console.log('   ANIMESALT FULL CARTOON, ANIME & MOVIE SCRAPER & INGESTOR');
  console.log('='.repeat(65));

  if (MERGE_ONLY) {
    if (!fs.existsSync(SCRAPED_DATA_PATH)) {
      console.error('No scraped data found to merge! Run full scraper first.');
      return;
    }
    const scraped = JSON.parse(fs.readFileSync(SCRAPED_DATA_PATH, 'utf8'));
    await mergeIntoDatabase(scraped);
    return;
  }

  // 1. Discover or load catalog cache
  let catalog = [];
  if (fs.existsSync(SITEMAP_CACHE_PATH) && !DISCOVER_ONLY) {
    try {
      catalog = JSON.parse(fs.readFileSync(SITEMAP_CACHE_PATH, 'utf8'));
      console.log(`Loaded ${catalog.length} items from existing sitemap cache.`);
    } catch (e) {
      catalog = await discoverAllTitles();
    }
  } else {
    catalog = await discoverAllTitles();
  }

  if (DISCOVER_ONLY) {
    console.log('Discovery complete. Exiting (--discover flag set).');
    return;
  }

  // 2. Scrape full data
  const scrapedData = await scrapeAllCatalog(catalog);

  // 3. Merge into database and rebuild catalog
  await mergeIntoDatabase(scrapedData);

  console.log('\nAll done! Every anime, cartoon show, and movie from AnimeSalt has been scraped and ingested.');
}

main().catch(console.error);
