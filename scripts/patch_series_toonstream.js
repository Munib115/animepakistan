/**
 * scripts/patch_series_toonstream.js
 *
 * For every series in DB that has AnimeSalt-only episodes:
 * 1. Finds the series on ToonStream (by slug/title/search)
 * 2. Fetches all episode pages and extracts stream iframes
 * 3. Patches the DB episodes with ToonStream streams
 *
 * Usage: node scripts/patch_series_toonstream.js [--limit=10] [--slug=naruto]
 */

const fs = require('fs');
const path = require('path');
const cheerio = require('cheerio');

const DB_PATH = path.join(__dirname, '../src/data/anime-db.json');
const CATALOG_PATH = path.join(__dirname, '../src/data/anime-catalog.json');
const EP_CACHE_PATH = path.join(__dirname, 'toonstream_episode_streams_cache.json');

const HEADERS = {
  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36',
  'Referer': 'https://toonstream.us/',
};

const delay = (ms) => new Promise(r => setTimeout(r, ms));
const args = process.argv.slice(2);
const LIMIT_ARG = args.find(a => a.startsWith('--limit='));
const LIMIT = LIMIT_ARG ? parseInt(LIMIT_ARG.split('=')[1], 10) : Infinity;
const SLUG_ARG = args.find(a => a.startsWith('--slug='));
const TARGET_SLUG = SLUG_ARG ? SLUG_ARG.split('=')[1] : null;

function isValidStream(url) {
  if (!url) return false;
  const l = url.toLowerCase();
  if (!l.startsWith('http')) return false;
  const BAD = ['themoviedb.org', 'youtube.com', 'google.', 'about:blank',
    'short.icu', 'toonstream.us', 'animesalt.cx'];
  return !BAD.some(b => l.includes(b));
}

async function fetchHtml(url, retries = 3) {
  for (let i = 0; i < retries; i++) {
    try {
      const res = await fetch(url, { headers: HEADERS, signal: AbortSignal.timeout(12000) });
      if (res.status === 404 || res.status >= 500) { await delay(1000); continue; }
      if (!res.ok) { await delay(1000); continue; }
      return await res.text();
    } catch (e) {
      if (i === retries - 1) return null;
      await delay(1500);
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
  return streams;
}

function normalize(s) {
  return (s || '').toLowerCase().replace(/[^a-z0-9]/g, '');
}

function buildSources(streams) {
  const active = streams.filter(s => !s.includes('as-cdn'));
  const salt = streams.filter(s => s.includes('as-cdn'));
  const sources = [];
  active.forEach((s, i) => sources.push({ label: i === 0 ? 'Server 1' : 'Server ' + (i + 1), url: s, isMultiAudio: true }));
  salt.forEach(s => sources.push({ label: 'AnimeSalt (Backup)', url: s, isMultiAudio: true }));
  return sources;
}

async function searchToonStream(query) {
  const q = encodeURIComponent(query.trim().replace(/\(.*\)/g, '').trim());
  const html = await fetchHtml('https://toonstream.us/?s=' + q);
  if (!html) return null;
  const $ = cheerio.load(html);
  const results = [];
  $('article, .item').each((_, el) => {
    const href = $(el).find('a[href*="/series/"]').first().attr('href') || '';
    const title = $(el).find('h2, h3, .entry-title').first().text().trim() || '';
    if (!href || !title) return;
    const slugMatch = href.match(/\/series\/([^/?\s]+)/);
    if (!slugMatch) return;
    results.push({ title, slug: slugMatch[1], url: href.startsWith('http') ? href : 'https://toonstream.us' + href });
  });
  return results;
}

async function findToonSeriesUrl(series) {
  // Try known slugs
  const slugCandidates = [
    series.toonSlug,
    series.slug,
    series.saltSlug,
    series.title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, ''),
    series.title.toLowerCase().replace(/[':&!?()"]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, ''),
  ].filter(Boolean);

  for (const slug of slugCandidates) {
    const url = 'https://toonstream.us/series/' + slug + '/';
    const html = await fetchHtml(url);
    if (html && html.includes('/episode/')) {
      return { url, slug };
    }
    await delay(200);
  }

  // Search fallback
  const results = await searchToonStream(series.title);
  await delay(400);
  if (results && results.length > 0) {
    const best = results.find(r =>
      normalize(r.title) === normalize(series.title) ||
      normalize(r.title).includes(normalize(series.title).substring(0, 10)) ||
      normalize(series.title).includes(normalize(r.title).substring(0, 10))
    );
    if (best) return { url: best.url, slug: best.slug };
  }

  return null;
}

async function patchSeriesEpisodes(series, toonUrl, toonSlug, epCache) {
  series.toonSlug = toonSlug;
  series.toonUrl = toonUrl;

  const html = await fetchHtml(toonUrl);
  if (!html) return 0;

  const $ = cheerio.load(html);
  const epUrls = [];
  $('a[href*="/episode/"]').each((_, el) => {
    const h = $(el).attr('href') || '';
    const full = h.startsWith('http') ? h : 'https://toonstream.us' + h;
    if (!epUrls.includes(full)) epUrls.push(full);
  });

  if (epUrls.length === 0) return 0;
  console.log('  Episodes on ToonStream: ' + epUrls.length);

  let updated = 0;

  for (const epUrl of epUrls) {
    const match = epUrl.match(/\/episode\/(.+?)-(\d+)x(\d+)\/?$/i);
    if (!match) continue;
    const season = parseInt(match[2], 10);
    const num = parseInt(match[3], 10);

    if (!series.episodes) series.episodes = [];
    let ep = series.episodes.find(e => e.season === season && e.number === num);
    if (ep && ep.toonStreamUrl) continue; // already has ToonStream

    let streamData = epCache[epUrl];
    if (!streamData || !streamData.toonStreamUrl) {
      const epHtml = await fetchHtml(epUrl);
      const streams = extractStreams(epHtml || '');
      if (streams.length === 0) { await delay(300); continue; }
      const active = streams.filter(s => !s.includes('as-cdn'));
      const salt = streams.filter(s => s.includes('as-cdn'));
      streamData = {
        streamUrl: active[0] || salt[0] || '',
        toonStreamUrl: active[0] || '',
        saltStreamUrl: salt[0] || '',
        streamSources: buildSources(streams),
      };
      epCache[epUrl] = streamData;
      await delay(350);
    }

    if (!streamData.toonStreamUrl) continue;

    if (ep) {
      ep.toonUrl = epUrl;
      ep.toonStreamUrl = streamData.toonStreamUrl;
      ep.streamUrl = streamData.toonStreamUrl;
      ep.streamSources = streamData.streamSources;
    } else {
      const seriesSlug = match[1];
      ep = {
        number: num, season,
        title: 'S' + season + ' E' + num + ': Episode ' + num,
        slug: seriesSlug + '-' + season + 'x' + num,
        url: epUrl, toonUrl: epUrl,
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

  return updated;
}

async function main() {
  console.log('AnimePakistan - Series Episode ToonStream Patcher');
  console.log('='.repeat(55));

  const db = JSON.parse(fs.readFileSync(DB_PATH, 'utf8'));
  let epCache = {};
  if (fs.existsSync(EP_CACHE_PATH)) {
    try { epCache = JSON.parse(fs.readFileSync(EP_CACHE_PATH, 'utf8')); } catch (e) {}
  }

  let targetSeries;
  if (TARGET_SLUG) {
    targetSeries = db.filter(x => x.slug === TARGET_SLUG || x.saltSlug === TARGET_SLUG || x.toonSlug === TARGET_SLUG);
  } else {
    targetSeries = db.filter(x =>
      x.type === 'series' &&
      (x.episodes || []).some(e => !e.toonStreamUrl)
    );
  }

  console.log('Series to patch: ' + targetSeries.length);
  let totalEps = 0;
  let saveCount = 0;

  for (let i = 0; i < targetSeries.length && i < LIMIT; i++) {
    const series = targetSeries[i];
    console.log('\n[' + (i + 1) + '/' + Math.min(targetSeries.length, LIMIT) + '] "' + series.title + '"');

    const found = await findToonSeriesUrl(series);
    if (!found) {
      console.log('  Not found on ToonStream');
      await delay(500);
      continue;
    }

    console.log('  Found: ' + found.url);
    const updated = await patchSeriesEpisodes(series, found.url, found.slug, epCache);
    totalEps += updated;

    if (updated > 0) {
      saveCount++;
      console.log('  Patched ' + updated + ' episodes');
      if (saveCount % 3 === 0) {
        fs.writeFileSync(DB_PATH, JSON.stringify(db, null, 2));
        fs.writeFileSync(EP_CACHE_PATH, JSON.stringify(epCache, null, 2));
        console.log('  >> Auto-saved');
      }
    }

    await delay(800);
  }

  fs.writeFileSync(DB_PATH, JSON.stringify(db, null, 2));
  fs.writeFileSync(EP_CACHE_PATH, JSON.stringify(epCache, null, 2));

  const catalog = db.map(item => ({
    id: item.id || 'ap-' + item.slug,
    title: item.title,
    slug: item.slug,
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

  console.log('\nDone! Total episodes patched: ' + totalEps);
}

main().catch(err => {
  console.error('Fatal:', err);
  process.exit(1);
});
