/**
 * scripts/patch_all_toonstream_streams.js
 *
 * Mass-patches the anime DB to replace AnimeSalt-only stream links
 * with ToonStream stream links for all movies and series.
 *
 * 1. Matches DB items to ToonStream catalog by slug/title
 * 2. For movies: fetches stream iframes directly from the movie page
 * 3. For series: fetches ALL episode pages and extracts stream iframes
 * 4. Saves results back to anime-db.json and anime-catalog.json
 *
 * Usage: node scripts/patch_all_toonstream_streams.js [--movies] [--series] [--limit=50]
 */

const fs = require('fs');
const path = require('path');
const cheerio = require('cheerio');

const DB_PATH = path.join(__dirname, '../src/data/anime-db.json');
const CATALOG_PATH = path.join(__dirname, '../src/data/anime-catalog.json');
const TOON_CATALOG_PATH = path.join(__dirname, 'toonstream_catalog_cache.json');
const EP_CACHE_PATH = path.join(__dirname, 'toonstream_episode_streams_cache.json');

const HEADERS = {
  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36',
  'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
  'Accept-Language': 'en-US,en;q=0.9',
  'Referer': 'https://toonstream.us/',
};

const delay = (ms) => new Promise((r) => setTimeout(r, ms));

const args = process.argv.slice(2);
const ONLY_MOVIES = args.includes('--movies');
const ONLY_SERIES = args.includes('--series');
const LIMIT_ARG = args.find(a => a.startsWith('--limit='));
const LIMIT = LIMIT_ARG ? parseInt(LIMIT_ARG.split('=')[1], 10) : Infinity;

function isValidStream(url) {
  if (!url || typeof url !== 'string') return false;
  const l = url.toLowerCase().trim();
  if (!l.startsWith('http')) return false;
  const BAD = [
    'themoviedb.org', 'youtube.com', 'google.', 'facebook.', 'twitter.',
    'about:blank', 'short.icu', 'short.link', 'toonstream.us', 'animesalt.cx',
    'wikipedia.', 'imdb.com', 'anilist.co', 'myanimelist.net',
  ];
  return !BAD.some(b => l.includes(b));
}

async function fetchHtml(url, retries = 3) {
  for (let i = 0; i < retries; i++) {
    try {
      const res = await fetch(url, { headers: HEADERS, signal: AbortSignal.timeout(12000) });
      if (!res.ok) { await delay(1000); continue; }
      return await res.text();
    } catch (e) {
      if (i === retries - 1) return null;
      await delay(1500 * (i + 1));
    }
  }
  return null;
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
  $('[data-player], [data-embed], .playex').each((_, el) => {
    let s = $(el).attr('data-player') || $(el).attr('data-embed') || $(el).attr('data-src') || '';
    if (s.startsWith('//')) s = 'https:' + s;
    if (isValidStream(s) && !streams.includes(s)) streams.push(s);
  });
  return streams;
}

function normalize(str) {
  return (str || '')
    .toLowerCase()
    .replace(/[''`]/g, '')
    .replace(/\b(season\s*\d+|part\s*\d+|s\d+|cour\s*\d+|dub|sub|hindi|urdu)\b/gi, '')
    .replace(/[^\w\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function buildStreamSources(streams) {
  const active = streams.filter(s => !s.includes('as-cdn'));
  const salt = streams.filter(s => s.includes('as-cdn'));
  const sources = [];
  active.forEach((s, idx) => {
    sources.push({ label: idx === 0 ? 'Server 1' : 'Server ' + (idx + 1), url: s, isMultiAudio: true });
  });
  salt.forEach(s => {
    sources.push({ label: 'AnimeSalt (Backup)', url: s, isMultiAudio: true });
  });
  return sources;
}

function matchToon(dbItem, toonCatalog) {
  if (dbItem.toonSlug) {
    const direct = toonCatalog.find(t => t.slug === dbItem.toonSlug);
    if (direct) return direct;
  }
  const normTitle = normalize(dbItem.title);
  const exact = toonCatalog.find(t => normalize(t.title) === normTitle);
  if (exact) return exact;
  const fuzzy = toonCatalog.find(t => {
    const nt = normalize(t.title);
    return (nt.includes(normTitle) && normTitle.length > 5) ||
           (normTitle.includes(nt) && nt.length > 5);
  });
  if (fuzzy) return fuzzy;
  const slugMatch = toonCatalog.find(t =>
    t.slug === dbItem.slug ||
    t.slug === (dbItem.saltSlug || '') ||
    dbItem.slug.includes(t.slug) ||
    t.slug.includes(dbItem.slug)
  );
  return slugMatch || null;
}

async function patchMovie(movie, toonEntry) {
  const url = toonEntry.url.startsWith('http') ? toonEntry.url : 'https://toonstream.us' + toonEntry.url;
  const html = await fetchHtml(url);
  if (!html) return false;
  const streams = extractStreams(html);
  const activeStreams = streams.filter(s => !s.includes('as-cdn'));
  if (activeStreams.length === 0) return false;
  movie.toonSlug = toonEntry.slug;
  movie.toonUrl = url;
  movie.toonStreamUrl = activeStreams[0];
  movie.streamUrl = activeStreams[0];
  movie.streamSources = buildStreamSources(streams);
  console.log('  OK Movie: "' + movie.title + '" -> ' + activeStreams.length + ' ToonStream server(s)');
  return true;
}

async function fetchEpisodeList(toonSeriesUrl) {
  const html = await fetchHtml(toonSeriesUrl);
  if (!html) return [];
  const $ = cheerio.load(html);
  const epUrls = [];
  $('a[href*="/episode/"]').each((_, el) => {
    const h = $(el).attr('href') || '';
    const full = h.startsWith('http') ? h : 'https://toonstream.us' + h;
    if (!epUrls.includes(full)) epUrls.push(full);
  });
  return epUrls;
}

function parseEpSlug(epUrl) {
  const match = epUrl.match(/\/episode\/(.+?)(?:-(\d+)x(\d+))?\/?$/i);
  if (!match) return null;
  const fullSlug = match[1] + (match[2] ? '-' + match[2] + 'x' + match[3] : '');
  const season = match[2] ? parseInt(match[2], 10) : 1;
  const number = match[3] ? parseInt(match[3], 10) : null;
  return { slug: fullSlug, season, number };
}

async function patchSeriesEpisodes(series, toonEntry, epCache) {
  const seriesUrl = toonEntry.url.startsWith('http') ? toonEntry.url : 'https://toonstream.us' + toonEntry.url;
  series.toonSlug = toonEntry.slug;
  series.toonUrl = seriesUrl;

  const epUrls = await fetchEpisodeList(seriesUrl);
  if (epUrls.length === 0) {
    console.log('  No episodes found on ToonStream for "' + series.title + '"');
    return 0;
  }

  console.log('  Found ' + epUrls.length + ' episode links');
  let updated = 0;

  for (const epUrl of epUrls) {
    const parsed = parseEpSlug(epUrl);
    if (!parsed || parsed.number === null) continue;
    const { season, number } = parsed;

    if (!series.episodes) series.episodes = [];
    let ep = series.episodes.find(e => e.season === season && e.number === number);
    const needsPatch = !ep || !ep.toonStreamUrl || ep.toonStreamUrl.trim() === '';
    if (!needsPatch) continue;

    let streamData = epCache[epUrl];
    if (!streamData || !streamData.streamUrl) {
      const html = await fetchHtml(epUrl);
      const streams = extractStreams(html || '');
      if (streams.length === 0) { await delay(400); continue; }
      const active = streams.filter(s => !s.includes('as-cdn'));
      const salt = streams.filter(s => s.includes('as-cdn'));
      streamData = {
        streamUrl: active[0] || salt[0] || '',
        toonStreamUrl: active[0] || '',
        saltStreamUrl: salt[0] || '',
        streamSources: buildStreamSources(streams),
      };
      epCache[epUrl] = streamData;
      await delay(400);
    }

    if (!streamData.toonStreamUrl) continue;

    if (ep) {
      ep.toonUrl = epUrl;
      ep.toonStreamUrl = streamData.toonStreamUrl;
      ep.streamUrl = streamData.toonStreamUrl;
      ep.streamSources = streamData.streamSources;
    } else {
      ep = {
        number, season,
        title: 'S' + season + ' E' + number + ': Episode ' + number,
        slug: parsed.slug,
        url: epUrl, toonUrl: epUrl, toonSlug: parsed.slug,
        thumbnail: series.poster || '',
        streamUrl: streamData.streamUrl,
        toonStreamUrl: streamData.toonStreamUrl,
        streamSources: streamData.streamSources,
      };
      series.episodes.push(ep);
    }
    updated++;
  }

  if (series.episodes) {
    series.episodes.sort((a, b) => a.season === b.season ? a.number - b.number : a.season - b.season);
    series.episodeCount = series.episodes.length;
  }

  if (updated > 0) {
    console.log('  OK Series: "' + series.title + '" -> ' + updated + ' episodes patched');
  }
  return updated;
}

async function main() {
  console.log('AnimePakistan x ToonStream Mass Stream Patcher');
  console.log('='.repeat(55));

  const db = JSON.parse(fs.readFileSync(DB_PATH, 'utf8'));
  const toonCatalog = JSON.parse(fs.readFileSync(TOON_CATALOG_PATH, 'utf8'));
  let epCache = {};
  if (fs.existsSync(EP_CACHE_PATH)) {
    try { epCache = JSON.parse(fs.readFileSync(EP_CACHE_PATH, 'utf8')); } catch (e) {}
  }

  const toonMovies = toonCatalog.filter(t => t.type === 'movie');
  const toonSeries = toonCatalog.filter(t => t.type === 'series');
  let moviePatched = 0;
  let epPatched = 0;
  let saveCount = 0;

  // MOVIES
  if (!ONLY_SERIES) {
    const dbMovies = db.filter(x => x.type === 'movie' && !x.toonStreamUrl);
    console.log('\nMovies without ToonStream: ' + dbMovies.length);
    let count = 0;
    for (const movie of dbMovies) {
      if (count >= LIMIT) break;
      const toonEntry = matchToon(movie, toonMovies);
      if (!toonEntry) { count++; continue; }
      const patched = await patchMovie(movie, toonEntry);
      if (patched) { moviePatched++; saveCount++; }
      count++;
      if (saveCount > 0 && saveCount % 20 === 0) {
        fs.writeFileSync(DB_PATH, JSON.stringify(db, null, 2));
        fs.writeFileSync(EP_CACHE_PATH, JSON.stringify(epCache, null, 2));
        console.log('  Auto-saved (' + saveCount + ' so far)');
      }
      await delay(500);
    }
  }

  // SERIES
  if (!ONLY_MOVIES) {
    const saltOnlySeries = db.filter(x => x.type === 'series' && (x.episodes || []).some(e => !e.toonStreamUrl));
    console.log('\nSeries with missing ToonStream episodes: ' + saltOnlySeries.length);
    let count = 0;
    for (const series of saltOnlySeries) {
      if (count >= LIMIT) break;
      const toonEntry = matchToon(series, toonSeries);
      if (!toonEntry) { count++; continue; }
      console.log('\n[' + (count + 1) + '/' + Math.min(saltOnlySeries.length, LIMIT) + '] "' + series.title + '" -> ToonStream: "' + toonEntry.title + '"');
      const updated = await patchSeriesEpisodes(series, toonEntry, epCache);
      epPatched += updated;
      count++;
      if (updated > 0) {
        saveCount++;
        if (saveCount % 5 === 0) {
          fs.writeFileSync(DB_PATH, JSON.stringify(db, null, 2));
          fs.writeFileSync(EP_CACHE_PATH, JSON.stringify(epCache, null, 2));
          console.log('  Auto-saved progress');
        }
      }
      await delay(800);
    }
  }

  // Final save
  console.log('\nSaving final database...');
  fs.writeFileSync(DB_PATH, JSON.stringify(db, null, 2));
  fs.writeFileSync(EP_CACHE_PATH, JSON.stringify(epCache, null, 2));

  const catalog = db.map(item => ({
    id: item.id || 'ap-' + item.slug,
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
    episodesCount: item.type === 'series' ? (item.episodes ? item.episodes.length : 0) : undefined,
    hasStreams: item.type === 'movie'
      ? !!(item.streamUrl || item.toonStreamUrl)
      : (item.episodes ? item.episodes.some(e => !!(e.streamUrl || e.toonStreamUrl)) : false),
  }));
  fs.writeFileSync(CATALOG_PATH, JSON.stringify(catalog, null, 2));

  console.log('\nDone!');
  console.log('  Movies patched: ' + moviePatched);
  console.log('  Episode streams patched: ' + epPatched);
}

main().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});
