const fs = require('fs');
const path = require('path');

const DB_PATH = path.join(__dirname, '..', 'src', 'data', 'anime-db.json');
const db = JSON.parse(fs.readFileSync(DB_PATH, 'utf8'));

// High-priority series slugs
const PRIORITY_SLUGS = [
  'devil-may-cry',
  'tomb-raider-king',
  'dragon-ball-z',
  'dragon-ball-super',
  'dragon-ball-daima',
  'dragon-ball',
  'dragon-ball-z-kai'
];

async function fetchStreamWithRetry(url, retries = 2) {
  for (let i = 0; i <= retries; i++) {
    try {
      const controller = new AbortController();
      const id = setTimeout(() => controller.abort(), 6000);
      const res = await fetch(url, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
          'Referer': 'https://animesalt.cx/'
        },
        signal: controller.signal
      });
      clearTimeout(id);
      if (!res.ok) continue;
      const html = await res.text();
      // Match as-cdn video link
      const match = html.match(/https:\/\/as-cdn\d+\.top\/video\/[a-f0-9]+/i);
      if (match) return match[0];
    } catch (e) {}
  }
  return null;
}

// Concurrency pool
async function processInChunks(items, concurrency, workerFn) {
  const results = [];
  let index = 0;

  async function worker() {
    while (index < items.length) {
      const current = items[index++];
      try {
        const res = await workerFn(current);
        results.push(res);
      } catch (err) {
        results.push({ error: err.message, item: current });
      }
    }
  }

  const workers = Array(Math.min(concurrency, items.length)).fill(0).map(() => worker());
  await Promise.all(workers);
  return results;
}

async function run() {
  console.log('--- Starting Priority Series Patching ---');

  for (const slug of PRIORITY_SLUGS) {
    const anime = db.find(a => a.slug === slug || a.saltSlug === slug);
    if (!anime) {
      console.log(`Anime not found: ${slug}`);
      continue;
    }

    const episodes = anime.episodes || [];
    console.log(`\nProcessing ${anime.title} (${episodes.length} episodes)...`);

    const epsToFetch = episodes.filter(e => {
      const s = e.streamUrl || '';
      return !s || s.includes('multi-lang-plyr') || s.includes('short.icu');
    });

    console.log(`Episodes needing fresh as-cdn stream: ${epsToFetch.length}/${episodes.length}`);
    if (epsToFetch.length === 0) continue;

    let patchedCount = 0;
    const t0 = Date.now();

    await processInChunks(epsToFetch, 15, async (ep) => {
      const saltSlug = anime.saltSlug || anime.slug;
      const season = ep.season || (ep.slug.match(/(\d+)x\d+/i) ? parseInt(ep.slug.match(/(\d+)x\d+/i)[1], 10) : 1);
      const epNum = ep.number || 1;
      const epUrl = ep.url && ep.url.startsWith('http') ? ep.url : `https://animesalt.cx/episode/${saltSlug}-${season}x${epNum}/`;

      const stream = await fetchStreamWithRetry(epUrl);
      if (stream) {
        ep.streamUrl = stream;
        patchedCount++;
      }
    });

    console.log(`Patched ${patchedCount}/${epsToFetch.length} episodes in ${((Date.now() - t0) / 1000).toFixed(1)}s`);

    // Save DB after each anime
    fs.writeFileSync(DB_PATH, JSON.stringify(db, null, 2));
    console.log(`Saved DB for ${anime.title}`);
  }

  console.log('\n--- Priority Series Patching Complete! ---');
}

run().catch(console.error);
