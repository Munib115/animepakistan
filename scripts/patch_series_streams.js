const fs = require('fs');
const path = require('path');
const cheerio = require('cheerio');

const DB_PATH = path.join(__dirname, '../src/data/anime-db.json');
const db = JSON.parse(fs.readFileSync(DB_PATH, 'utf8'));

// Popular / top series to prioritize
const PRIORITY_SERIES_SLUGS = [
  'konosuba-gods-blessing-on-this-wonderful-world',
  'jaadugar-a-witch-in-mongolia',
  'black-torch',
  'barbie-dreamtopia',
  'nippon-sangoku-the-three-nations-of-the-crimson-sun',
  'bat-fam',
  'cinderella-chef',
  'taisho-era-contract-marriage-the-substitute-bride-and-a-soldiers-fierce-love',
  'blade',
  'a-mortals-journey-to-immortality',
  'case-closed-zeros-tea-time',
  'case-closed-the-culprit-hanzawa',
  '%e3%80%90oshi-no-ko%e3%80%91',
  'the-exiled-heavy-knight-knows-how-to-game-the-system',
  'cells-at-work-code-black',
  'the-grimm-variations',
  'dandelion',
  'stranger-things-tales-from-85',
  'the-share-houses-secret-rule',
  'adams-sweet-agony',
  'little-krishna',
  'barbie-it-takes-two',
  'kurukshetra-the-great-war-of-mahabharata',
  'skeleton-knight-in-another-world',
  'kamen-rider-gavv',
  'dorohedoro',
  'sword-of-the-demon-hunter',
  'grand-blue-dreaming',
  'ben-10-classic',
  'ben-10-alien-force',
  'ben-10-ultimate-alien',
  'ben-10-omniverse',
  'solo-leveling',
  'jujutsu-kaisen',
  'demon-slayer-kimetsu-no-yaiba'
];

async function fetchEpisodeStream(epUrl) {
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 8000);
    const res = await fetch(epUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
        'Referer': 'https://animesalt.cx/',
      },
      signal: controller.signal,
    });
    clearTimeout(timer);
    if (!res.ok) return null;
    const html = await res.text();
    const $ = cheerio.load(html);
    const iframe = $('iframe').first().attr('src') || $('iframe').first().attr('data-src');
    if (iframe && iframe.startsWith('http') && !iframe.includes('google') && !iframe.includes('disqus')) {
      return iframe.trim();
    }
  } catch (err) {
    // ignore
  }
  return null;
}

async function main() {
  console.log('Starting series episode stream patcher...');
  let totalPatched = 0;

  for (const slug of PRIORITY_SERIES_SLUGS) {
    const anime = db.find(x => x.slug === slug && x.type === 'series');
    if (!anime || !anime.episodes || anime.episodes.length === 0) continue;

    console.log(`\nProcessing ${anime.title} (${anime.episodes.length} episodes)...`);
    for (const ep of anime.episodes) {
      if (ep.streamUrl) continue; // already cached
      if (!ep.url || !ep.url.startsWith('http')) continue;

      const stream = await fetchEpisodeStream(ep.url);
      if (stream) {
        ep.streamUrl = stream;
        totalPatched++;
        process.stdout.write(`✓ Ep ${ep.number} `);
      } else {
        process.stdout.write(`✗ Ep ${ep.number} `);
      }
    }
  }

  console.log(`\n\nTotal episodes patched with streamUrl: ${totalPatched}`);
  fs.writeFileSync(DB_PATH, JSON.stringify(db, null, 2), 'utf8');
  console.log('Saved anime-db.json successfully.');
}

main();
