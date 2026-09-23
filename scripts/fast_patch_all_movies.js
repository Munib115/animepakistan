const fs = require('fs');
const path = require('path');
const cheerio = require('cheerio');

const DB_PATH = path.join(__dirname, '../src/data/anime-db.json');
const CATALOG_PATH = path.join(__dirname, '../src/data/anime-catalog.json');
const TOON_CAT_PATH = path.join(__dirname, 'toonstream_catalog_cache.json');

const HEADERS = {
  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36',
  'Referer': 'https://toonstream.us/',
  'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
};

const delay = (ms) => new Promise((r) => setTimeout(r, ms));

function isValidStream(url) {
  if (!url || typeof url !== 'string') return false;
  const l = url.toLowerCase().trim();
  if (!l.startsWith('http')) return false;
  const BAD = [
    'themoviedb.org', 'youtube.com', 'google.', 'facebook.', 'about:blank',
    'short.icu', 'short.link', 'toonstream.us', 'animesalt.cx', 'wikipedia.',
  ];
  return !BAD.some((b) => l.includes(b));
}

async function fetchHtml(url) {
  try {
    const res = await fetch(url, { headers: HEADERS, signal: AbortSignal.timeout(10000) });
    if (!res.ok) return null;
    return await res.text();
  } catch (e) {
    return null;
  }
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
  const active = streams.filter((s) => !s.includes('as-cdn'));
  const salt = streams.filter((s) => s.includes('as-cdn'));
  const sources = [];
  active.forEach((s, i) => {
    sources.push({
      label: i === 0 ? 'ToonStream 1 (HD)' : `ToonStream ${i + 1} (Mirror)`,
      url: s,
      isMultiAudio: true,
    });
  });
  salt.forEach((s) => {
    sources.push({
      label: 'AnimeSalt (Backup)',
      url: s,
      isMultiAudio: true,
    });
  });
  return sources;
}

function slugify(str) {
  return (str || '')
    .toLowerCase()
    .replace(/['":!?()&]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
}

async function patchAllMovies() {
  const db = JSON.parse(fs.readFileSync(DB_PATH, 'utf8'));
  const toonCat = fs.existsSync(TOON_CAT_PATH)
    ? JSON.parse(fs.readFileSync(TOON_CAT_PATH, 'utf8'))
    : [];

  const toonMovies = toonCat.filter((x) => x.type === 'movie');
  console.log(`ToonStream catalog has ${toonMovies.length} movies.`);

  // 1. First, check if there are ToonStream movies not in DB at all, and add them!
  const dbSlugs = new Set(db.map((x) => x.slug));
  const dbToonUrls = new Set(db.map((x) => (x.toonUrl || '').replace(/\/$/, '')));

  let addedNewMovies = 0;
  for (const tm of toonMovies) {
    const cleanUrl = tm.url.replace(/\/$/, '');
    const cleanSlug = slugify(tm.title) || tm.slug;
    if (!dbToonUrls.has(cleanUrl) && !dbSlugs.has(cleanSlug)) {
      db.push({
        title: tm.title,
        slug: cleanSlug,
        toonSlug: tm.slug,
        toonUrl: tm.url,
        url: tm.url,
        type: 'movie',
        poster: tm.poster || '',
        backdrop: tm.poster || '',
        description: `Watch ${tm.title} full movie in Hindi, Urdu, English dub and sub on Anime Pakistan.`,
        genres: tm.genres || ['Anime', 'Movie'],
        audioLanguages: ['Hindi', 'Urdu', 'English'],
        rating: 8.2,
        year: 2024,
      });
      dbSlugs.add(cleanSlug);
      dbToonUrls.add(cleanUrl);
      addedNewMovies++;
    }
  }
  console.log(`Added ${addedNewMovies} new movies from ToonStream catalog into DB.`);

  // 2. Now patch stream links for movies that don't have toonStreamUrl yet
  const moviesWithoutToon = db.filter((x) => x.type === 'movie' && !x.toonStreamUrl);
  console.log(`Movies in DB needing ToonStream streams: ${moviesWithoutToon.length}`);

  let patched = 0;
  for (let i = 0; i < moviesWithoutToon.length; i++) {
    const movie = moviesWithoutToon[i];
    process.stdout.write(`[${i + 1}/${moviesWithoutToon.length}] ${movie.title}... `);

    // Candidates
    const candidates = [];
    if (movie.toonUrl) candidates.push(movie.toonUrl);
    if (movie.toonSlug) candidates.push(`https://toonstream.us/movies/${movie.toonSlug}/`);

    // Match in toonCat
    const foundInCat = toonMovies.find((t) => {
      const tNorm = slugify(t.title);
      const mNorm = slugify(movie.title);
      return tNorm === mNorm || (tNorm.length > 5 && mNorm.includes(tNorm)) || (mNorm.length > 5 && tNorm.includes(mNorm));
    });

    if (foundInCat) {
      candidates.push(foundInCat.url);
      if (!movie.poster && foundInCat.poster) movie.poster = foundInCat.poster;
    }

    candidates.push(`https://toonstream.us/movies/${slugify(movie.title)}/`);
    candidates.push(`https://toonstream.us/movies/${movie.slug}/`);
    if (movie.saltSlug) candidates.push(`https://toonstream.us/movies/${movie.saltSlug}/`);

    let streamFound = false;
    for (const url of [...new Set(candidates)]) {
      const html = await fetchHtml(url);
      if (!html || html.length < 5000) continue;
      const streams = extractStreams(html);
      const active = streams.filter((s) => !s.includes('as-cdn'));
      if (active.length > 0) {
        movie.toonUrl = url;
        const m = url.match(/\/movies\/([^/?]+)/);
        if (m) movie.toonSlug = m[1];
        movie.toonStreamUrl = active[0];
        movie.streamUrl = active[0];
        movie.streamSources = buildStreamSources(streams);
        streamFound = true;
        patched++;
        console.log(`MATCHED (${active.length} streams)`);
        break;
      }
      await delay(200);
    }

    if (!streamFound) {
      console.log('not found');
    }

    if (patched > 0 && patched % 15 === 0) {
      fs.writeFileSync(DB_PATH, JSON.stringify(db, null, 2));
      console.log(`  [Saved progress: ${patched} patched]`);
    }

    await delay(300);
  }

  // 3. Normalize all items so episodeCount and episodesCount are consistent
  db.forEach((item) => {
    if (item.type === 'series') {
      const count = (item.episodes ? item.episodes.length : 0) || item.episodeCount || item.episodesCount || 0;
      item.episodeCount = count;
      item.episodesCount = count;
    }
  });

  fs.writeFileSync(DB_PATH, JSON.stringify(db, null, 2));

  // 4. Update catalog
  const catalog = db.map((item) => ({
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
    episodeCount: item.type === 'series' ? (item.episodes ? item.episodes.length : (item.episodeCount || 0)) : undefined,
    episodesCount: item.type === 'series' ? (item.episodes ? item.episodes.length : (item.episodesCount || 0)) : undefined,
    hasStreams: item.type === 'movie'
      ? !!(item.streamUrl || item.toonStreamUrl)
      : (item.episodes ? item.episodes.some((e) => !!(e.streamUrl || e.toonStreamUrl)) : false),
  }));
  fs.writeFileSync(CATALOG_PATH, JSON.stringify(catalog, null, 2));

  console.log(`\nSuccessfully finished! Total movies patched: ${patched}`);
}

patchAllMovies().catch(console.error);
