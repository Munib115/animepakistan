const fs = require('fs');
const path = require('path');
const cheerio = require('cheerio');

const DB_PATH = path.join(__dirname, '..', 'src', 'data', 'anime-db.json');
const CATALOG_PATH = path.join(__dirname, '..', 'src', 'data', 'anime-catalog.json');
const CACHE_PATH = path.join(__dirname, 'animesalt_episode_streams_cache.json');

// Dead hostnames to remove completely
const DEAD_HOSTS = [
  'raretoonsindia.co',
  'emturbovid.com',
  'emturbovid.dev',
  'rubystm.com',
  'stmruby.com',
  'rubyvid.com',
  'streamruby.com',
  'multimovies.cloud',
  'streamsb.net',
  'sstreamsb.net',
  'sttreamsb.net',
  'sytramsb.net',
  'watchsb.com',
  'bullstream.xyz',
  'vidxstream.xyz',
  'fhdgdmirrorbot.nl',
  'sd,gdmirrorbot.nl',
  'gfhd.dmirrorbot.nl',
  'sd.',
  'hd.',
  'blakiteapi1xyz',
  'deaddrive.icu',
  'as-cdn26.top',
  'as-cdn25.top',
  'as-cdn24.top',
  'as-cdn23.top',
  'as-cdn22.top',
  'as-cdn21.top',
  'as-cdn20.top',
];

function isDeadHost(url) {
  if (!url || typeof url !== 'string') return true;
  const l = url.toLowerCase();
  for (const dead of DEAD_HOSTS) {
    if (l.includes(dead)) return true;
  }
  return false;
}

function sanitizeUrl(url) {
  if (!url || typeof url !== 'string') return '';
  let clean = url
    .replace(/^http:\/\//i, 'https://')
    .replace(/animesalt\.(link|me)/gi, 'animesalt.cx')
    .trim();

  // Convert short.icu directly to abyssplayer
  if (clean.includes('short.icu/')) {
    clean = clean.replace(/https?:\/\/short\.icu\/([a-zA-Z0-9_\-]+)/gi, 'https://player.abyssplayer.com/$1');
  }

  return clean;
}

function unpackAnimeSaltDataUrl(url) {
  if (!url || typeof url !== 'string') return [];
  if (!url.includes('data=') || (!url.includes('plyr') && !url.includes('player') && !url.includes('animesalt'))) {
    return [];
  }
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
      let link = sanitizeUrl(item.link);
      if (link && !isDeadHost(link)) {
        results.push({
          label: `Abyss (${item.language || 'HD'})`,
          url: link,
          isMultiAudio: true
        });
      }
    }
    return results;
  } catch (e) {
    return [];
  }
}

function cleanAndUnpackSources(sourcesList) {
  if (!sourcesList || !Array.isArray(sourcesList)) return [];
  const cleaned = [];
  const seenUrls = new Set();

  for (const s of sourcesList) {
    if (!s || !s.url) continue;

    // 1. If it's an AnimeSalt plyr wrapper with data parameter
    if (s.url.includes('data=') && (s.url.includes('plyr') || s.url.includes('player') || s.url.includes('animesalt'))) {
      const unpacked = unpackAnimeSaltDataUrl(s.url);
      for (const u of unpacked) {
        if (!seenUrls.has(u.url)) {
          seenUrls.add(u.url);
          cleaned.push(u);
        }
      }
      continue;
    }

    // 2. Sanitize URL
    const sanitized = sanitizeUrl(s.url);
    if (!sanitized || isDeadHost(sanitized) || seenUrls.has(sanitized)) continue;

    // Check if it's dead shortener
    if (sanitized.includes('short.icu') || sanitized.includes('linkvertise') || sanitized.includes('shortener')) {
      continue;
    }

    seenUrls.add(sanitized);
    cleaned.push({
      ...s,
      url: sanitized
    });
  }

  // Sort: Abyss first (1), P2P (2), Cloudy (3), etc.
  cleaned.sort((a, b) => {
    const getPrio = (u) => {
      const l = (u || '').toLowerCase();
      if (l.includes('abyssplayer.com')) return 1;
      if (l.includes('p2pplay.online') || l.includes('strp2p.live')) return 2;
      if (l.includes('cloudy.upns.one')) return 3;
      if (l.includes('filesforever.link')) return 4;
      if (l.includes('vidmoly.net')) return 5;
      if (l.includes('vidstreaming.xyz')) return 6;
      if (l.includes('turbonewvid.com')) return 7;
      if (l.includes('strmup.to') || l.includes('strmup.cc')) return 8;
      if (l.includes('vexal.top')) return 15;
      return 10;
    };
    return getPrio(a.url) - getPrio(b.url);
  });

  return cleaned;
}

async function scrapeAnimeSaltLive(targetUrl) {
  try {
    const res = await fetch(targetUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
        'Referer': 'https://animesalt.cx/'
      },
      signal: AbortSignal.timeout(8000)
    });
    if (!res.ok) return [];
    const html = await res.text();
    const $ = cheerio.load(html);

    const sources = [];
    $('iframe').each((_, el) => {
      const raw = $(el).attr('data-src') || $(el).attr('src') || '';
      if (!raw) return;
      const clean = sanitizeUrl(raw.startsWith('//') ? 'https:' + raw : raw);

      if (clean.includes('data=') && (clean.includes('plyr') || clean.includes('player') || clean.includes('animesalt'))) {
        const unpacked = unpackAnimeSaltDataUrl(clean);
        sources.push(...unpacked);
      } else if (!isDeadHost(clean) && !clean.includes('short.icu') && !clean.includes('about:blank')) {
        sources.push({
          label: clean.includes('vexal') ? 'Server 2 (HD)' : 'Server 1 (HD)',
          url: clean,
          isMultiAudio: true
        });
      }
    });

    return cleanAndUnpackSources(sources);
  } catch (e) {
    return [];
  }
}

async function run() {
  console.log('Loading database...');
  const db = JSON.parse(fs.readFileSync(DB_PATH, 'utf8'));

  let moviesFixed = 0;
  let episodesFixed = 0;
  let moviesScrapedLive = 0;
  let liveScrapeCandidates = [];

  for (const item of db) {
    if (item.type === 'movie') {
      const origCount = item.streamSources ? item.streamSources.length : 0;
      item.streamSources = cleanAndUnpackSources(item.streamSources);
      if (item.streamSources.length !== origCount || item.streamSources.some(s => s.url.includes('abyssplayer.com'))) {
        moviesFixed++;
      }
      if (item.streamSources.length === 0) {
        liveScrapeCandidates.push(item);
      }
    }

    if (item.episodes) {
      for (const ep of item.episodes) {
        const origCount = ep.streamSources ? ep.streamSources.length : 0;
        ep.streamSources = cleanAndUnpackSources(ep.streamSources);
        if (ep.streamSources.length !== origCount || ep.streamSources.some(s => s.url.includes('abyssplayer.com'))) {
          episodesFixed++;
        }
      }
    }
  }

  console.log(`Unpacked and sanitized streams: ${moviesFixed} movies and ${episodesFixed} episodes updated in DB!`);
  console.log(`Found ${liveScrapeCandidates.length} movies with 0 streams. Attempting live fetch from AnimeSalt...`);

  // Concurrently fetch live AnimeSalt pages in batches of 10
  const BATCH_SIZE = 10;
  for (let i = 0; i < liveScrapeCandidates.length; i += BATCH_SIZE) {
    const batch = liveScrapeCandidates.slice(i, i + BATCH_SIZE);
    await Promise.all(batch.map(async (movie) => {
      const saltSlug = movie.saltSlug || movie.slug;
      const targetUrl = movie.url && movie.url.includes('animesalt')
        ? movie.url
        : `https://animesalt.cx/movies/${saltSlug}/`;
      
      const liveSources = await scrapeAnimeSaltLive(targetUrl);
      if (liveSources.length > 0) {
        movie.streamSources = liveSources;
        moviesScrapedLive++;
      }
    }));
    process.stdout.write(`Scraped live: ${moviesScrapedLive}/${liveScrapeCandidates.length}...\r`);
  }

  console.log(`\nLive scraping complete: Successfully recovered streams for ${moviesScrapedLive} movies!`);

  // Also clean animesalt_episode_streams_cache.json
  if (fs.existsSync(CACHE_PATH)) {
    console.log('Cleaning animesalt_episode_streams_cache.json...');
    const cache = JSON.parse(fs.readFileSync(CACHE_PATH, 'utf8'));
    let cacheUpdated = 0;
    for (const [url, sources] of Object.entries(cache)) {
      cache[url] = cleanAndUnpackSources(sources);
      cacheUpdated++;
    }
    fs.writeFileSync(CACHE_PATH, JSON.stringify(cache, null, 2), 'utf8');
    console.log(`Saved clean cache (${cacheUpdated} URLs).`);
  }

  console.log('Saving anime-db.json...');
  fs.writeFileSync(DB_PATH, JSON.stringify(db, null, 2), 'utf8');
  console.log('Saved anime-db.json.');

  // Regenerate anime-catalog.json
  console.log('Regenerating anime-catalog.json...');
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
    audioLanguages: item.audioLanguages || ['Hindi'],
    rating: item.rating || 8.0,
    year: item.year || 2024,
    episodeCount: item.type === 'movie' ? 1 : (item.episodes ? item.episodes.length : 1),
    source: item.source || 'animesalt'
  }));
  fs.writeFileSync(CATALOG_PATH, JSON.stringify(catalog, null, 2), 'utf8');
  console.log(`Saved anime-catalog.json (${catalog.length} items).`);
}

run().catch(console.error);
