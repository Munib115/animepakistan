/**
 * scripts/patch_movies_from_toonstream.js
 *
 * For every movie in the DB that has no ToonStream stream:
 * 1. Tries to find it on ToonStream via their search
 * 2. If found, fetches the movie page and extracts iframe stream URLs
 * 3. Patches the DB entry with the new ToonStream streams
 *
 * Usage: node scripts/patch_movies_from_toonstream.js [--limit=50] [--slug=specific-slug]
 */

const fs = require('fs');
const path = require('path');
const cheerio = require('cheerio');

const DB_PATH = path.join(__dirname, '../src/data/anime-db.json');
const CATALOG_PATH = path.join(__dirname, '../src/data/anime-catalog.json');
const EP_CACHE_PATH = path.join(__dirname, 'toonstream_episode_streams_cache.json');

const HEADERS = {
  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36',
  'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
  'Accept-Language': 'en-US,en;q=0.9',
  'Referer': 'https://toonstream.us/',
};

const delay = (ms) => new Promise(r => setTimeout(r, ms));
const args = process.argv.slice(2);
const LIMIT_ARG = args.find(a => a.startsWith('--limit='));
const LIMIT = LIMIT_ARG ? parseInt(LIMIT_ARG.split('=')[1], 10) : Infinity;
const SLUG_ARG = args.find(a => a.startsWith('--slug='));
const TARGET_SLUG = SLUG_ARG ? SLUG_ARG.split('=')[1] : null;

function isValidStream(url) {
  if (!url || typeof url !== 'string') return false;
  const l = url.toLowerCase().trim();
  if (!l.startsWith('http')) return false;
  const BAD = [
    'themoviedb.org', 'youtube.com', 'google.', 'facebook.', 'about:blank',
    'short.icu', 'short.link', 'toonstream.us', 'animesalt.cx', 'wikipedia.',
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
  $('[data-player],[data-embed],.playex').each((_, el) => {
    let s = $(el).attr('data-player') || $(el).attr('data-embed') || $(el).attr('data-src') || '';
    if (s.startsWith('//')) s = 'https:' + s;
    if (isValidStream(s) && !streams.includes(s)) streams.push(s);
  });
  return streams;
}

// ToonStream search
async function searchToonStream(query) {
  const q = encodeURIComponent(query.trim());
  const url = 'https://toonstream.us/?s=' + q;
  const html = await fetchHtml(url);
  if (!html) return [];

  const $ = cheerio.load(html);
  const results = [];

  $('article, .item').each((_, el) => {
    const href = $(el).find('a[href*="/movies/"], a[href*="/series/"]').first().attr('href') ||
                 $(el).find('a.lnk-blk').first().attr('href') || '';
    const title = $(el).find('h2, h3, .entry-title, .title').first().text().trim() || '';
    if (!href || !title) return;
    const full = href.startsWith('http') ? href : 'https://toonstream.us' + href;
    const slugMatch = href.match(/\/(series|movies)\/([^/?\s]+)/);
    if (!slugMatch) return;
    results.push({
      title,
      url: full,
      slug: slugMatch[2],
      type: href.includes('/movies/') ? 'movie' : 'series',
    });
  });

  return results;
}

// Also try direct URL construction
function buildDirectMovieUrl(dbItem) {
  // ToonStream movie URLs: /movies/{slug}/
  const candidates = [
    dbItem.slug,
    dbItem.saltSlug,
    dbItem.toonSlug,
    dbItem.title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, ''),
    dbItem.title.toLowerCase().replace(/[':&!?]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, ''),
  ].filter(Boolean);
  return candidates.map(s => 'https://toonstream.us/movies/' + s + '/');
}

function normalize(s) {
  return (s || '').toLowerCase().replace(/[^a-z0-9]/g, '');
}

function buildStreamSources(streams) {
  const active = streams.filter(s => !s.includes('as-cdn'));
  const salt = streams.filter(s => s.includes('as-cdn'));
  const sources = [];
  active.forEach((s, i) => sources.push({ label: i === 0 ? 'Server 1' : 'Server ' + (i + 1), url: s, isMultiAudio: true }));
  salt.forEach(s => sources.push({ label: 'AnimeSalt (Backup)', url: s, isMultiAudio: true }));
  return sources;
}

async function findAndPatchMovie(movie) {
  // 1. Try direct URL candidates
  const directUrls = buildDirectMovieUrl(movie);
  for (const url of directUrls) {
    const html = await fetchHtml(url);
    if (!html) continue;
    // Real 404 pages are typically short; actual movie pages are 50kb+
    if (html.length < 5000) continue;
    const streams = extractStreams(html);
    const active = streams.filter(s => !s.includes('as-cdn'));
    if (active.length > 0) {
      const slugMatch = url.match(/\/movies\/([^/]+)/);
      movie.toonSlug = slugMatch ? slugMatch[1] : movie.slug;
      movie.toonUrl = url;
      movie.toonStreamUrl = active[0];
      movie.streamUrl = active[0];
      movie.streamSources = buildStreamSources(streams);
      console.log('  [DIRECT] "' + movie.title + '" -> ' + active.length + ' stream(s)');
      return true;
    }
    await delay(300);
  }

  // 2. Try search
  const searchResults = await searchToonStream(movie.title);
  await delay(400);

  for (const result of searchResults) {
    if (result.type !== 'movie') continue;
    if (normalize(result.title) !== normalize(movie.title) && 
        !normalize(result.title).includes(normalize(movie.title).substring(0, 12)) &&
        !normalize(movie.title).includes(normalize(result.title).substring(0, 12))) {
      continue;
    }
    const html = await fetchHtml(result.url);
    if (!html) continue;
    const streams = extractStreams(html);
    const active = streams.filter(s => !s.includes('as-cdn'));
    if (active.length > 0) {
      movie.toonSlug = result.slug;
      movie.toonUrl = result.url;
      movie.toonStreamUrl = active[0];
      movie.streamUrl = active[0];
      movie.streamSources = buildStreamSources(streams);
      console.log('  [SEARCH] "' + movie.title + '" -> ' + active.length + ' stream(s)');
      return true;
    }
    await delay(300);
  }

  return false;
}

async function main() {
  console.log('AnimePakistan - Movie ToonStream Stream Patcher');
  console.log('='.repeat(55));

  const db = JSON.parse(fs.readFileSync(DB_PATH, 'utf8'));

  let targetMovies;
  if (TARGET_SLUG) {
    targetMovies = db.filter(x => x.slug === TARGET_SLUG || x.saltSlug === TARGET_SLUG);
  } else {
    targetMovies = db.filter(x => x.type === 'movie' && !x.toonStreamUrl);
  }

  console.log('Target movies: ' + targetMovies.length);
  let patched = 0;
  let count = 0;

  for (const movie of targetMovies) {
    if (count >= LIMIT) break;
    process.stdout.write('[' + (count + 1) + '/' + Math.min(targetMovies.length, LIMIT) + '] ' + movie.title + '... ');
    const success = await findAndPatchMovie(movie);
    if (success) {
      patched++;
      process.stdout.write('PATCHED\n');
    } else {
      process.stdout.write('not found on ToonStream\n');
    }
    count++;

    if (patched > 0 && patched % 10 === 0) {
      fs.writeFileSync(DB_PATH, JSON.stringify(db, null, 2));
      console.log('  >> Auto-saved (' + patched + ' patched so far)');
    }

    await delay(600);
  }

  // Save
  fs.writeFileSync(DB_PATH, JSON.stringify(db, null, 2));

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

  console.log('\nDone! Movies patched: ' + patched + ' / ' + count);
}

main().catch(err => {
  console.error('Fatal:', err);
  process.exit(1);
});
