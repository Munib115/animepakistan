const fs = require('fs');
const path = require('path');
const cheerio = require('cheerio');

const DB_PATH = path.join(__dirname, '../src/data/anime-db.json');
const CATALOG_PATH = path.join(__dirname, '../src/data/anime-catalog.json');
const CACHE_PATH = path.join(__dirname, 'animesalt_episode_streams_cache.json');

const HEADERS = {
  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36',
  'Referer': 'https://animesalt.cx/',
  'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8'
};

const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

function sanitizeUrl(url) {
  if (!url || typeof url !== 'string') return '';
  let clean = url
    .replace(/^http:\/\//i, 'https://')
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
      let link = sanitizeUrl(item.link);
      if (link && !link.includes('about:blank') && !link.includes('short.icu')) {
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

async function fetchEpisodePage(epUrl, retries = 2) {
  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      const res = await fetch(epUrl, {
        headers: HEADERS,
        signal: AbortSignal.timeout(6000)
      });
      if (res.status === 404) return null;
      if (res.ok) return await res.text();
    } catch (e) {
      if (attempt === retries) return null;
      await delay(300 * attempt);
    }
  }
  return null;
}

function extractStreamsFromHtml(html) {
  if (!html) return [];
  const $ = cheerio.load(html);
  const sources = [];
  const seen = new Set();

  $('iframe').each((_, el) => {
    const raw = $(el).attr('data-src') || $(el).attr('src') || '';
    if (!raw) return;
    const clean = sanitizeUrl(raw.startsWith('//') ? 'https:' + raw : raw);
    if (!clean || seen.has(clean)) return;
    seen.add(clean);

    if (clean.includes('data=') && (clean.includes('plyr') || clean.includes('player') || clean.includes('animesalt'))) {
      const unpacked = unpackAnimeSaltDataUrl(clean);
      for (const u of unpacked) {
        if (!seen.has(u.url)) {
          seen.add(u.url);
          sources.push(u);
        }
      }
    } else if (!clean.includes('google') && !clean.includes('facebook') && !clean.includes('youtube')) {
      sources.push({
        label: clean.includes('vexal') ? 'Server 2 (HD)' : 'Server 1 (HD)',
        url: clean,
        isMultiAudio: true
      });
    }
  });

  sources.sort((a, b) => {
    const p = (u) => (u.includes('abyssplayer.com') ? 1 : u.includes('p2p') ? 2 : 10);
    return p(a.url) - p(b.url);
  });

  return sources;
}

async function main() {
  console.log('Loading database and stream cache...');
  const db = JSON.parse(fs.readFileSync(DB_PATH, 'utf8'));
  let cache = {};
  if (fs.existsSync(CACHE_PATH)) {
    try {
      cache = JSON.parse(fs.readFileSync(CACHE_PATH, 'utf8'));
    } catch(e) {}
  }

  // Collect all episodes needing streams
  const queue = [];
  for (const item of db) {
    if (item.type === 'series' && item.episodes) {
      const saltSlug = item.saltSlug || item.slug;
      for (const ep of item.episodes) {
        if (!ep.streamSources || ep.streamSources.length === 0) {
          const epSeason = ep.season || 1;
          const epNumber = ep.number || 1;
          const epUrl = ep.url && ep.url.startsWith('http')
            ? ep.url
            : `https://animesalt.cx/episode/${saltSlug}-${epSeason}x${epNumber}/`;

          queue.push({
            seriesTitle: item.title,
            saltSlug,
            ep,
            epUrl
          });
        }
      }
    }
  }

  const totalToHarvest = queue.length;
  console.log(`Total episodes needing streams: ${totalToHarvest}`);

  const CONCURRENCY = 16;
  let processed = 0;
  let succeeded = 0;
  let failed = 0;
  let saveCounter = 0;
  const startTime = Date.now();

  async function worker(workerId) {
    while (queue.length > 0) {
      const task = queue.shift();
      if (!task) break;

      // 1. Check cache first
      let sources = cache[task.epUrl];
      if (!sources || sources.length === 0) {
        // Fetch live
        const html = await fetchEpisodePage(task.epUrl);
        if (html) {
          sources = extractStreamsFromHtml(html);
          if (sources.length > 0) {
            cache[task.epUrl] = sources;
          }
        }
      }

      if (sources && sources.length > 0) {
        task.ep.streamSources = sources;
        succeeded++;
      } else {
        failed++;
      }

      processed++;
      saveCounter++;

      if (saveCounter >= 100) {
        saveCounter = 0;
        fs.writeFileSync(DB_PATH, JSON.stringify(db, null, 2), 'utf8');
        fs.writeFileSync(CACHE_PATH, JSON.stringify(cache, null, 2), 'utf8');
        const elapsed = (Date.now() - startTime) / 1000;
        const rate = (processed / elapsed).toFixed(1);
        const percent = ((processed / totalToHarvest) * 100).toFixed(1);
        console.log(`[Progress] ${processed}/${totalToHarvest} (${percent}%) | Succeeded: ${succeeded} | Failed: ${failed} | ${rate} req/s`);
      }
    }
  }

  console.log(`Starting ${CONCURRENCY} parallel workers...`);
  await Promise.all(Array.from({ length: CONCURRENCY }, (_, i) => worker(i + 1)));

  // Final saves
  fs.writeFileSync(DB_PATH, JSON.stringify(db, null, 2), 'utf8');
  fs.writeFileSync(CACHE_PATH, JSON.stringify(cache, null, 2), 'utf8');

  // Regenerate catalog
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

  const totalTime = ((Date.now() - startTime) / 1000).toFixed(1);
  console.log(`\n==============================================`);
  console.log(`HARVEST COMPLETE in ${totalTime}s!`);
  console.log(`Total processed: ${processed}`);
  console.log(`Streams recovered: ${succeeded}`);
  console.log(`Failed / Not hosted: ${failed}`);
  console.log(`==============================================\n`);
}

main().catch(console.error);
