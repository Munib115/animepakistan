const fs = require('fs');
const path = require('path');

const DB_PATH = path.join(__dirname, '..', 'src', 'data', 'anime-db.json');
const db = JSON.parse(fs.readFileSync(DB_PATH, 'utf8'));

// Top popular series to do first
const TOP_SLUGS = [
  'one-piece',
  'naruto',
  'naruto-shippuden',
  'boruto-naruto-next-generations',
  'bleach',
  'bleach-thousand-year-blood-war',
  'jujutsu-kaisen',
  'demon-slayer-kimetsu-no-yaiba',
  'attack-on-titan',
  'solo-leveling',
  'death-note',
  'hunter-x-hunter-2011',
  'black-clover',
  'my-hero-academia',
  'tokyo-ghoul',
  'chainsaw-man',
  'fullmetal-alchemist-brotherhood',
  'vinland-saga',
  'spy-x-family',
  'haikyuu',
  'dr-stone',
  'one-punch-man',
  'sword-art-online',
  'fairy-tail'
];

async function fetchStreamWithRetry(url, retries = 2) {
  for (let i = 0; i <= retries; i++) {
    try {
      const controller = new AbortController();
      const id = setTimeout(() => controller.abort(), 5000);
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
      const match = html.match(/https:\/\/as-cdn\d+\.top\/video\/[a-f0-9]+/i);
      if (match) return match[0];
    } catch (e) {}
  }
  return null;
}

// Concurrency pool
async function processInChunks(items, concurrency, workerFn) {
  let index = 0;
  async function worker() {
    while (index < items.length) {
      const current = items[index++];
      try {
        await workerFn(current);
      } catch (err) {}
    }
  }
  const workers = Array(Math.min(concurrency, items.length)).fill(0).map(() => worker());
  await Promise.all(workers);
}

async function run() {
  console.log('--- Starting Global Series Stream Patching ---');

  // Filter series that need patching
  const seriesList = db.filter(a => a.type === 'series');

  // Sort top anime first, then others
  seriesList.sort((a, b) => {
    const aTop = TOP_SLUGS.indexOf(a.slug);
    const bTop = TOP_SLUGS.indexOf(b.slug);
    if (aTop !== -1 && bTop !== -1) return aTop - bTop;
    if (aTop !== -1) return -1;
    if (bTop !== -1) return 1;
    return (b.episodes?.length || 0) - (a.episodes?.length || 0);
  });

  let totalPatched = 0;
  let seriesProcessed = 0;

  for (const anime of seriesList) {
    const episodes = anime.episodes || [];
    const epsToFetch = episodes.filter(e => {
      const s = e.streamUrl || '';
      return !s || s.includes('multi-lang-plyr') || s.includes('short.icu');
    });

    if (epsToFetch.length === 0) continue;

    seriesProcessed++;
    const t0 = Date.now();
    let animePatched = 0;

    await processInChunks(epsToFetch, 20, async (ep) => {
      const saltSlug = anime.saltSlug || anime.slug;
      const season = ep.season || (ep.slug.match(/(\d+)x\d+/i) ? parseInt(ep.slug.match(/(\d+)x\d+/i)[1], 10) : 1);
      const epNum = ep.number || 1;
      const epUrl = ep.url && ep.url.startsWith('http') ? ep.url : `https://animesalt.cx/episode/${saltSlug}-${season}x${epNum}/`;

      const stream = await fetchStreamWithRetry(epUrl);
      if (stream) {
        ep.streamUrl = stream;
        animePatched++;
        totalPatched++;
      }
    });

    console.log(`[${seriesProcessed}] ${anime.title}: Patched ${animePatched}/${epsToFetch.length} in ${((Date.now() - t0) / 1000).toFixed(1)}s (Total: ${totalPatched})`);

    // Save every 5 series
    if (seriesProcessed % 5 === 0) {
      fs.writeFileSync(DB_PATH, JSON.stringify(db, null, 2));
      console.log(`>>> DB Checkpoint Saved (Total patched: ${totalPatched}) <<<`);
    }
  }

  // Final save
  fs.writeFileSync(DB_PATH, JSON.stringify(db, null, 2));
  console.log(`\nAll Done! Total episodes updated with direct as-cdn streams: ${totalPatched}`);
}

run().catch(console.error);
