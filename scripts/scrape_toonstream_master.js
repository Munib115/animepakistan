/**
 * scripts/scrape_toonstream_master.js
 *
 * Master scraper for ToonStream:
 * 1. Restores ToonStream streams from cache for existing episodes.
 * 2. Crawls ToonStream Homepage (Fresh Drops), Anime, Cartoon, and Movies pages.
 * 3. Discovers brand new anime/cartoons/movies and adds them to DB.
 * 4. Scrapes every stream link (Ruby, FilesForever, Abyss, Cloudy, Vidmoly, Emturbovid).
 * 5. Saves anime-db.json, anime-catalog.json, and cache.
 */

const fs = require('fs');
const path = require('path');
const cheerio = require('cheerio');

const DB_PATH = path.join(__dirname, '..', 'src', 'data', 'anime-db.json');
const CATALOG_PATH = path.join(__dirname, '..', 'src', 'data', 'anime-catalog.json');
const CACHE_PATH = path.join(__dirname, 'toonstream_episode_streams_cache.json');

const HEADERS = {
  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36',
  'Referer': 'https://toonstream.us/',
  'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8'
};

const delay = (ms) => new Promise(resolve => setTimeout(resolve, ms));

async function fetchWithRetry(url, retries = 3, timeoutMs = 8000) {
  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      const res = await fetch(url, { headers: HEADERS, signal: AbortSignal.timeout(timeoutMs) });
      if (!res.ok) {
        if (res.status === 404) return null;
        await delay(800 * attempt);
        continue;
      }
      return await res.text();
    } catch (err) {
      if (attempt === retries) return null;
      await delay(800 * attempt);
    }
  }
  return null;
}

function isValidStream(url) {
  if (!url || typeof url !== 'string') return false;
  const l = url.toLowerCase().trim();
  if (!l.startsWith('http')) return false;
  if (
    l.includes('as-cdn') || // Dead Cloudflare 522
    l.includes('youtube.com') ||
    l.includes('themoviedb.org') ||
    l.includes('google') ||
    l.includes('facebook') ||
    l.includes('about:blank') ||
    l.includes('short.icu') ||
    l.includes('short.link')
  ) {
    return false;
  }
  return true;
}

function extractStreams(html) {
  if (!html) return [];
  const $ = cheerio.load(html);
  const streams = [];
  $('iframe').each((_, el) => {
    let s = $(el).attr('src') || $(el).attr('data-src') || '';
    if (s.startsWith('//')) s = 'https:' + s;
    if (isValidStream(s) && !streams.includes(s)) streams.push(s);
  });
  return streams;
}

function buildStreamSources(streams) {
  const sources = [];
  streams.forEach((s, idx) => {
    sources.push({
      label: idx === 0 ? 'ToonStream 1 (HD)' : `ToonStream ${idx + 1} (Fast)`,
      url: s,
      isMultiAudio: true
    });
  });
  return sources;
}

async function scrapeStreamData(url) {
  const html = await fetchWithRetry(url);
  if (!html) return null;
  const streams = extractStreams(html);
  if (streams.length === 0) return null;

  return {
    streamUrl: streams[0],
    toonStreamUrl: streams[0],
    streamSources: buildStreamSources(streams)
  };
}

async function main() {
  console.log('====================================================');
  console.log('   TOONSTREAM MASTER SCRAPER & STREAM ENGINE         ');
  console.log('====================================================');

  console.log('Loading database and stream cache...');
  const db = JSON.parse(fs.readFileSync(DB_PATH, 'utf8'));
  let cache = {};
  if (fs.existsSync(CACHE_PATH)) {
    try { cache = JSON.parse(fs.readFileSync(CACHE_PATH, 'utf8')); } catch (e) {}
  }
  console.log(`Loaded DB: ${db.length} items. Cache: ${Object.keys(cache).length} stream entries.`);

  // ----------------------------------------------------
  // STEP 1: Apply cached streams to any episodes needing streams
  // ----------------------------------------------------
  console.log('\n--- Step 1: Restoring ToonStream Streams from Cache ---');
  let restoredCount = 0;

  db.forEach(item => {
    if (item.type === 'series' && item.episodes) {
      item.episodes.forEach(ep => {
        // If episode missing stream or has dead/empty streamSources
        const hasValidSource = ep.streamSources && ep.streamSources.length > 0 && !ep.streamSources[0].url.includes('as-cdn');
        if (!hasValidSource) {
          const candidateUrls = [
            ep.toonUrl,
            ep.url,
            `https://toonstream.us/episode/${ep.slug}/`,
            ep.toonSlug ? `https://toonstream.us/episode/${ep.toonSlug}/` : null,
            item.toonSlug ? `https://toonstream.us/episode/${item.toonSlug}-${ep.season}x${ep.number}/` : null
          ].filter(Boolean);

          for (const u of candidateUrls) {
            if (cache[u]) {
              const cached = cache[u];
              const validSources = (cached.streamSources || [])
                .filter(s => isValidStream(s.url))
                .map((s, i) => ({
                  label: i === 0 ? 'ToonStream 1 (HD)' : `ToonStream ${i + 1} (Fast)`,
                  url: s.url,
                  isMultiAudio: true
                }));

              if (validSources.length > 0) {
                ep.toonUrl = u;
                ep.toonStreamUrl = validSources[0].url;
                ep.streamUrl = validSources[0].url;
                ep.streamSources = validSources;
                restoredCount++;
                break;
              }
            }
          }
        }
      });
    } else if (item.type === 'movie') {
      const hasValidSource = item.streamSources && item.streamSources.length > 0 && !item.streamSources[0].url.includes('as-cdn');
      if (!hasValidSource) {
        const candidateUrls = [
          item.toonUrl,
          item.url,
          item.toonSlug ? `https://toonstream.us/movies/${item.toonSlug}/` : null,
          `https://toonstream.us/movies/${item.slug}/`
        ].filter(Boolean);

        for (const u of candidateUrls) {
          if (cache[u]) {
            const cached = cache[u];
            const validSources = (cached.streamSources || [])
              .filter(s => isValidStream(s.url))
              .map((s, i) => ({
                label: i === 0 ? 'ToonStream 1 (HD)' : `ToonStream ${i + 1} (Fast)`,
                url: s.url,
                isMultiAudio: true
              }));

            if (validSources.length > 0) {
              item.toonUrl = u;
              item.toonStreamUrl = validSources[0].url;
              item.streamUrl = validSources[0].url;
              item.streamSources = validSources;
              restoredCount++;
              break;
            }
          }
        }
      }
    }
  });

  console.log(`Restored ToonStream streams for ${restoredCount} episodes/movies from cache!`);

  // ----------------------------------------------------
  // STEP 2: Scrape Homepage Fresh Drops
  // ----------------------------------------------------
  console.log('\n--- Step 2: Scraping Homepage Fresh Drops ---');
  const homeHtml = await fetchWithRetry('https://toonstream.us/home');
  const freshEpUrls = [];
  if (homeHtml) {
    const $ = cheerio.load(homeHtml);
    $('a[href*="/episode/"]').each((_, el) => {
      const h = $(el).attr('href');
      if (h) {
        const full = h.startsWith('http') ? h : `https://toonstream.us${h}`;
        if (!freshEpUrls.includes(full)) freshEpUrls.push(full);
      }
    });
  }
  console.log(`Found ${freshEpUrls.length} Fresh Drop episodes on ToonStream homepage.`);

  let newEpisodesCount = 0;
  for (const epUrl of freshEpUrls) {
    const match = epUrl.match(/\/episode\/([^/]+)-(\d+)x(\d+)/i);
    if (!match) continue;

    const seriesSlugPart = match[1].toLowerCase();
    const season = parseInt(match[2], 10);
    const num = parseInt(match[3], 10);
    const epSlug = `${seriesSlugPart}-${season}x${num}`;

    // Find series in DB
    let series = db.find(d => {
      if (d.type !== 'series') return false;
      const dSlug = d.slug.toLowerCase();
      const tSlug = (d.toonSlug || '').toLowerCase();
      return dSlug === seriesSlugPart || tSlug === seriesSlugPart ||
             dSlug.includes(seriesSlugPart) || seriesSlugPart.includes(dSlug);
    });

    if (series) {
      if (!series.episodes) series.episodes = [];
      let ep = series.episodes.find(e => e.season === season && e.number === num);

      if (!ep) {
        console.log(`✨ Scraping NEW Episode for "${series.title}": S${season} E${num}...`);
        const streamData = await scrapeStreamData(epUrl);
        ep = {
          number: num,
          season,
          title: `S${season} E${num}: Episode ${num}`,
          slug: epSlug,
          url: epUrl,
          toonUrl: epUrl,
          toonSlug: epSlug,
          thumbnail: series.poster || '',
          streamUrl: streamData?.streamUrl || '',
          toonStreamUrl: streamData?.toonStreamUrl || '',
          streamSources: streamData?.streamSources || []
        };
        series.episodes.push(ep);
        series.episodes.sort((a, b) => a.season === b.season ? a.number - b.number : a.season - b.season);
        series.episodeCount = series.episodes.length;
        newEpisodesCount++;

        if (streamData) {
          cache[epUrl] = streamData;
        }
        await delay(500);
      } else if (!ep.streamUrl || ep.streamUrl.includes('as-cdn')) {
        console.log(`🔄 Refreshing streams for "${series.title}": S${season} E${num}...`);
        const streamData = await scrapeStreamData(epUrl);
        if (streamData) {
          ep.toonUrl = epUrl;
          ep.toonStreamUrl = streamData.toonStreamUrl;
          ep.streamUrl = streamData.streamUrl;
          ep.streamSources = streamData.streamSources;
          cache[epUrl] = streamData;
        }
        await delay(500);
      }
    }
  }
  console.log(`Added ${newEpisodesCount} brand new episodes from Fresh Drops.`);

  // ----------------------------------------------------
  // STEP 3: Discover New Anime & Cartoons & Movies from Category Pages
  // ----------------------------------------------------
  console.log('\n--- Step 3: Discovering New Anime & Cartoons & Movies ---');
  const categories = [
    { name: 'anime', url: 'https://toonstream.us/category/anime?type=all&page=', pages: 3 },
    { name: 'cartoon', url: 'https://toonstream.us/category/cartoon?type=all&page=', pages: 3 },
    { name: 'movies', url: 'https://toonstream.us/category/movies?type=all&page=', pages: 3 }
  ];

  const discoveredItems = [];

  for (const cat of categories) {
    for (let p = 1; p <= cat.pages; p++) {
      const pageUrl = `${cat.url}${p}`;
      const pageHtml = await fetchWithRetry(pageUrl);
      if (!pageHtml) continue;
      const $ = cheerio.load(pageHtml);

      $('article, .item, .poster-item').each((_, el) => {
        const link = $(el).find('a[href*="/series/"], a[href*="/movies/"]').first().attr('href');
        const title = $(el).find('h2, h3, .entry-title, .title').first().text().trim() ||
                      $(el).find('a').first().attr('title') || '';
        const img = $(el).find('img').attr('data-src') || $(el).find('img').attr('src') || '';
        const ratingText = $(el).find('[class*="rating"], .imdb').text().trim();
        const rating = ratingText ? parseFloat(ratingText) || 8.0 : 8.0;

        if (link && title) {
          const isMovie = link.includes('/movies/');
          const slugMatch = link.match(/\/(series|movies)\/([^/?\s]+)/);
          const slug = slugMatch ? slugMatch[2].replace(/\/$/, '') : '';
          if (slug && !discoveredItems.some(x => x.slug === slug)) {
            discoveredItems.push({
              title,
              url: link.startsWith('http') ? link : `https://toonstream.us${link}`,
              slug,
              type: isMovie ? 'movie' : 'series',
              category: cat.name,
              poster: img,
              rating
            });
          }
        }
      });
      await delay(600);
    }
  }

  console.log(`Discovered ${discoveredItems.length} titles from ToonStream pages 1-3.`);

  // Check which are brand new to AnimePakistan
  const brandNewTitles = discoveredItems.filter(item => {
    return !db.some(d => d.slug.toLowerCase() === item.slug.toLowerCase() ||
                         (d.toonSlug || '').toLowerCase() === item.slug.toLowerCase() ||
                         d.title.toLowerCase() === item.title.toLowerCase());
  });

  console.log(`Found ${brandNewTitles.length} brand new titles not yet in our database!`);

  let addedNewTitlesCount = 0;
  for (const item of brandNewTitles) {
    console.log(`\nAdding new ${item.type} [${item.category}]: "${item.title}" (${item.slug})...`);
    const pageHtml = await fetchWithRetry(item.url);
    if (!pageHtml) continue;
    const $ = cheerio.load(pageHtml);

    const desc = $('.entry-content p, .description p, .synopsis, p').first().text().trim() || `${item.title} available in Hindi & Urdu Dubbed.`;
    const genres = [item.category === 'anime' ? 'Anime' : 'Cartoon'];
    $('a[href*="/category/"]').each((_, el) => {
      const g = $(el).text().trim();
      if (g && !genres.includes(g) && !['Home', 'Anime', 'Cartoon', 'Movies'].includes(g)) genres.push(g);
    });

    if (item.type === 'movie') {
      const streams = extractStreams(pageHtml);
      const streamSources = buildStreamSources(streams);
      const newMovie = {
        id: `ap-${item.slug}`,
        title: item.title,
        slug: item.slug,
        toonSlug: item.slug,
        type: 'movie',
        description: desc,
        poster: item.poster,
        backdrop: item.poster,
        rating: item.rating || 8.0,
        year: 2024,
        genres,
        audioLanguages: ['Hindi', 'Urdu'],
        url: item.url,
        toonUrl: item.url,
        streamUrl: streamSources[0]?.url || '',
        toonStreamUrl: streamSources[0]?.url || '',
        streamSources,
        source: 'toonstream'
      };
      db.push(newMovie);
      addedNewTitlesCount++;
      console.log(`  Added movie with ${streamSources.length} stream sources.`);
    } else {
      // Series: extract all episode links
      const epLinks = [];
      $('a[href*="/episode/"]').each((_, el) => {
        const href = $(el).attr('href');
        if (href) {
          const full = href.startsWith('http') ? href : `https://toonstream.us${href}`;
          if (!epLinks.includes(full)) epLinks.push(full);
        }
      });

      const episodes = [];
      for (let i = 0; i < epLinks.length; i++) {
        const epUrl = epLinks[i];
        const match = epUrl.match(/(\d+)x(\d+)/i);
        const season = match ? parseInt(match[1], 10) : 1;
        const num = match ? parseInt(match[2], 10) : i + 1;
        const epSlugMatch = epUrl.match(/\/episode\/([^/]+)/);
        const epSlug = epSlugMatch ? epSlugMatch[1] : `${item.slug}-${season}x${num}`;

        // Scrape stream for first 3 episodes immediately, others can be resolved on-demand
        let streamData = null;
        if (i < 3) {
          streamData = await scrapeStreamData(epUrl);
          if (streamData) cache[epUrl] = streamData;
          await delay(400);
        }

        episodes.push({
          number: num,
          season,
          title: `S${season} E${num}: Episode ${num}`,
          slug: epSlug,
          url: epUrl,
          toonUrl: epUrl,
          toonSlug: epSlug,
          thumbnail: item.poster,
          streamUrl: streamData?.streamUrl || '',
          toonStreamUrl: streamData?.toonStreamUrl || '',
          streamSources: streamData?.streamSources || []
        });
      }

      episodes.sort((a, b) => a.season === b.season ? a.number - b.number : a.season - b.season);

      const newSeries = {
        id: `ap-${item.slug}`,
        title: item.title,
        slug: item.slug,
        toonSlug: item.slug,
        type: 'series',
        description: desc,
        poster: item.poster,
        backdrop: item.poster,
        rating: item.rating || 8.0,
        year: 2024,
        genres,
        audioLanguages: ['Hindi', 'Urdu'],
        url: item.url,
        toonUrl: item.url,
        episodeCount: episodes.length,
        episodesCount: episodes.length,
        episodes,
        source: 'toonstream'
      };
      db.push(newSeries);
      addedNewTitlesCount++;
      console.log(`  Added series with ${episodes.length} episodes.`);
    }

    await delay(600);
  }

  // ----------------------------------------------------
  // STEP 4: Scrape Missing Streams for Popular Series in DB
  // ----------------------------------------------------
  console.log('\n--- Step 4: Scraping Missing Streams for Top Anime Series ---');
  let activeScrapedEpisodes = 0;
  const targetSeries = db.filter(d => d.type === 'series' && d.episodes && d.episodes.some(e => !e.streamUrl));

  console.log(`Found ${targetSeries.length} series with episodes needing streams. Processing priority batches...`);

  // Target the first 15 series that need streams most
  const prioritySeries = targetSeries.slice(0, 15);
  for (const s of prioritySeries) {
    console.log(`Processing "${s.title}" (${s.slug})...`);
    for (const ep of (s.episodes || [])) {
      if (!ep.streamUrl || ep.streamUrl.length < 5) {
        const candidateUrl = ep.toonUrl || (s.toonSlug ? `https://toonstream.us/episode/${s.toonSlug}-${ep.season}x${ep.number}/` : `https://toonstream.us/episode/${ep.slug}/`);
        const streamData = cache[candidateUrl] || await scrapeStreamData(candidateUrl);
        if (streamData && streamData.streamUrl) {
          ep.toonUrl = candidateUrl;
          ep.toonStreamUrl = streamData.toonStreamUrl;
          ep.streamUrl = streamData.streamUrl;
          ep.streamSources = streamData.streamSources;
          cache[candidateUrl] = streamData;
          activeScrapedEpisodes++;
          process.stdout.write(`  [${s.title}] S${ep.season}E${ep.number} -> ${streamData.streamSources.length} streams\r`);
        }
        await delay(350);
      }
    }
    console.log(`\nDone "${s.title}".`);
  }

  // ----------------------------------------------------
  // STEP 5: Save Database, Catalog, and Cache
  // ----------------------------------------------------
  console.log('\n--- Step 5: Saving Updated Database, Catalog, and Cache ---');
  fs.writeFileSync(DB_PATH, JSON.stringify(db, null, 2), 'utf8');
  console.log(`Saved anime-db.json (${db.length} items).`);

  fs.writeFileSync(CACHE_PATH, JSON.stringify(cache, null, 2), 'utf8');
  console.log(`Saved toonstream_episode_streams_cache.json (${Object.keys(cache).length} cached URLs).`);

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
    source: 'toonstream'
  }));

  fs.writeFileSync(CATALOG_PATH, JSON.stringify(catalog, null, 2), 'utf8');
  console.log(`Saved anime-catalog.json (${catalog.length} items).`);

  console.log('\n====================================================');
  console.log('   SCRAPING AND SYNC COMPLETE!                       ');
  console.log(`   - Streams restored from cache: ${restoredCount}`);
  console.log(`   - New episodes added: ${newEpisodesCount}`);
  console.log(`   - Brand new titles added: ${addedNewTitlesCount}`);
  console.log(`   - Live scraped episode streams: ${activeScrapedEpisodes}`);
  console.log('====================================================');
}

main().catch(console.error);
