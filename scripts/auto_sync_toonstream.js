/**
 * Live Auto-Sync Engine for ToonStream (New Episodes & New Series)
 * Checks 'Fresh Drop', Categories Page 1, and syncs newly dropped episodes/anime into AnimePakistan.
 * Usage: node scripts/auto_sync_toonstream.js
 */

const fs = require('fs');
const path = require('path');
const cheerio = require('cheerio');

const DB_PATH = path.join(__dirname, '../src/data/anime-db.json');
const CATALOG_PATH = path.join(__dirname, '../src/data/anime-catalog.json');
const EP_CACHE_PATH = path.join(__dirname, 'toonstream_episode_streams_cache.json');

const HEADERS = {
  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36',
  'Referer': 'https://toonstream.us/'
};

function isValidStream(url) {
  if (!url || typeof url !== 'string') return false;
  const l = url.toLowerCase().trim();
  if (!l.startsWith('http')) return false;
  if (
    l.includes('themoviedb.org') ||
    l.includes('youtube.com') ||
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

function extractStreamsFromHtml(html) {
  const $ = cheerio.load(html);
  const streams = [];
  $('iframe').each((_, el) => {
    let s = $(el).attr('src') || $(el).attr('data-src') || '';
    if (s.startsWith('//')) s = 'https:' + s;
    if (isValidStream(s) && !streams.includes(s)) streams.push(s);
  });
  return streams;
}

async function fetchHtml(url) {
  try {
    const res = await fetch(url, { headers: HEADERS, signal: AbortSignal.timeout(8000) });
    if (!res.ok) return null;
    return await res.text();
  } catch (e) {
    return null;
  }
}

function normalize(str) {
  return (str || '')
    .toLowerCase()
    .replace(/\b(season\s*\d+|part\s*\d+|s\d+|cour\s*\d+|dub|sub)\b/gi, '')
    .replace(/[^\w\s]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

async function scrapeEpisodeStreamData(epUrl) {
  const html = await fetchHtml(epUrl);
  if (!html) return null;
  const streams = extractStreamsFromHtml(html);
  if (streams.length === 0) return null;

  const activeStreams = streams.filter(s => !s.includes('as-cdn'));
  const saltStreams = streams.filter(s => s.includes('as-cdn'));
  const primaryStream = activeStreams[0] || saltStreams[0] || '';

  const sources = [];
  activeStreams.forEach((s, idx) => {
    sources.push({
      label: idx === 0 ? 'ToonStream 1 (HD)' : `ToonStream ${idx + 1} (Mirror)`,
      url: s,
      isMultiAudio: true
    });
  });
  saltStreams.forEach(s => {
    sources.push({
      label: 'AnimeSalt (Backup)',
      url: s,
      isMultiAudio: true
    });
  });

  return {
    streamUrl: primaryStream,
    toonStreamUrl: activeStreams[0] || '',
    saltStreamUrl: saltStreams[0] || '',
    streamSources: sources
  };
}

async function runAutoSync() {
  console.log(`[${new Date().toISOString()}] Checking ToonStream for Fresh Drops & New Releases...`);

  if (!fs.existsSync(DB_PATH)) {
    console.error('Database file not found:', DB_PATH);
    return;
  }

  const db = JSON.parse(fs.readFileSync(DB_PATH, 'utf8'));
  let epCache = {};
  if (fs.existsSync(EP_CACHE_PATH)) {
    try { epCache = JSON.parse(fs.readFileSync(EP_CACHE_PATH, 'utf8')); } catch (e) {}
  }

  // 1. Fetch Homepage to find "Fresh Drop" episodes
  const homeHtml = await fetchHtml('https://toonstream.us/home');
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

  let newEpisodesSynced = 0;
  let streamsUpdated = 0;

  for (const epUrl of freshEpUrls) {
    // URL format: /episode/{slug}-{season}x{number}/
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
      const sSlug = (d.saltSlug || '').toLowerCase();
      return dSlug === seriesSlugPart || tSlug === seriesSlugPart || sSlug === seriesSlugPart ||
        dSlug.includes(seriesSlugPart) || seriesSlugPart.includes(dSlug);
    });

    if (series) {
      if (!series.episodes) series.episodes = [];

      let ep = series.episodes.find(e => e.season === season && e.number === num);
      if (!ep) {
        // Brand new episode!
        console.log(`✨ New episode detected for "${series.title}": S${season} E${num}! Fetching streams...`);
        const streamData = await scrapeEpisodeStreamData(epUrl);
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
        newEpisodesSynced++;

        if (streamData) {
          epCache[epUrl] = streamData;
          streamsUpdated++;
        }
      } else if (!ep.streamUrl || ep.streamUrl.includes('as-cdn')) {
        // Episode exists but needs working ToonStream stream
        const streamData = epCache[epUrl] || await scrapeEpisodeStreamData(epUrl);
        if (streamData && streamData.streamUrl) {
          ep.toonUrl = epUrl;
          ep.toonStreamUrl = streamData.toonStreamUrl;
          if (!ep.saltStreamUrl && ep.streamUrl?.includes('as-cdn')) {
            ep.saltStreamUrl = ep.streamUrl;
          }
          ep.streamUrl = streamData.streamUrl;
          ep.streamSources = streamData.streamSources;
          epCache[epUrl] = streamData;
          streamsUpdated++;
        }
      }
    }
  }

  // 2. Check Page 1 of Anime, Cartoons, and Movies for newly added titles
  for (const cat of ['anime', 'cartoon', 'movies']) {
    const catHtml = await fetchHtml(`https://toonstream.us/category/${cat}?type=all&page=1`);
    if (!catHtml) continue;
    const $ = cheerio.load(catHtml);

    $('article').each((_, el) => {
      const linkEl = $(el).find('a').first();
      const href = linkEl.attr('href') || '';
      const title = $(el).find('.entry-title, h2, h3').text().trim() || linkEl.attr('title') || '';
      const img = $(el).find('img').attr('data-src') || $(el).find('img').attr('src') || '';
      const isMovie = href.includes('/movies/');
      const slug = href.replace(/^\/(series|movies)\//, '').replace(/\/$/, '');

      if (href && title && slug) {
        const cleanHref = href.startsWith('http') ? href : `https://toonstream.us${href}`;
        const exists = db.some(d => d.slug.toLowerCase() === slug.toLowerCase() || (d.toonSlug || '').toLowerCase() === slug.toLowerCase());

        if (!exists) {
          console.log(`🌟 Brand new ${cat} title detected on ToonStream: "${title}" (${slug})`);
        }
      }
    });
  }

  console.log(`\n--- Auto-Sync Results ---`);
  console.log(`New episodes added: ${newEpisodesSynced}`);
  console.log(`Episode streams refreshed: ${streamsUpdated}`);

  if (newEpisodesSynced > 0 || streamsUpdated > 0) {
    fs.writeFileSync(DB_PATH, JSON.stringify(db, null, 2));
    fs.writeFileSync(EP_CACHE_PATH, JSON.stringify(epCache, null, 2));

    // Update catalog
    const catalog = db.map(item => ({
      id: item.id || `ap-${item.slug}`,
      title: item.title,
      slug: item.slug,
      saltSlug: item.saltSlug || undefined,
      toonSlug: item.toonSlug || undefined,
      type: item.type,
      poster: item.poster,
      backdrop: item.backdrop || item.poster,
      rating: item.rating || 8.0,
      year: item.year || 2024,
      genres: item.genres || ['Anime'],
      audioLanguages: item.audioLanguages || ['Hindi', 'Urdu'],
      episodesCount: item.type === 'series' ? (item.episodes?.length || 0) : undefined,
      hasStreams: item.type === 'movie' ? !!item.streamUrl : (item.episodes?.some(e => !!e.streamUrl) ?? false)
    }));
    fs.writeFileSync(CATALOG_PATH, JSON.stringify(catalog, null, 2));
    console.log(`Database and catalog updated successfully.`);
  }

  return { newEpisodesSynced, streamsUpdated };
}

if (require.main === module) {
  runAutoSync().catch(console.error);
}

module.exports = { runAutoSync };
