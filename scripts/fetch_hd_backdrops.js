const fs = require('fs');
const path = require('path');

const DB_FILE = path.join(__dirname, '..', 'src', 'data', 'anime-db.json');
const TMDB_KEY = '119b065ce02f9f479565d6b99a758ee2';

const delay = ms => new Promise(r => setTimeout(r, ms));

async function fetchTMDBBackdrop(query, type) {
  try {
    const encoded = encodeURIComponent(query);
    const tvUrl = `https://api.themoviedb.org/3/search/tv?api_key=${TMDB_KEY}&query=${encoded}`;
    const movUrl = `https://api.themoviedb.org/3/search/movie?api_key=${TMDB_KEY}&query=${encoded}`;

    const [tvRes, movRes] = await Promise.all([
      fetch(tvUrl).then(r => r.json()).catch(() => ({ results: [] })),
      fetch(movUrl).then(r => r.json()).catch(() => ({ results: [] }))
    ]);

    const all = [...(tvRes.results || []), ...(movRes.results || [])];
    const withBackdrop = all.filter(x => x.backdrop_path);
    if (withBackdrop.length > 0) {
      withBackdrop.sort((a, b) => (b.popularity || 0) - (a.popularity || 0));
      return `https://image.tmdb.org/t/p/original${withBackdrop[0].backdrop_path}`;
    }
  } catch (e) {}
  return null;
}

async function main() {
  const items = JSON.parse(fs.readFileSync(DB_FILE, 'utf8'));
  console.log(`Checking backdrop images for ${items.length} items...`);

  let addedBackdrops = 0;

  for (let i = 0; i < items.length; i++) {
    const item = items[i];
    
    // If no backdrop or low quality banner
    if (!item.backdrop || item.backdrop.includes('animesalt')) {
      const q = item.title.replace(/\(.*\)/g, '').replace(/\[.*\]/g, '').trim();
      const backdrop = await fetchTMDBBackdrop(q, item.type);
      if (backdrop) {
        item.backdrop = backdrop;
        addedBackdrops++;
        console.log(`[${i + 1}/${items.length}] Added TMDB HD Backdrop for "${item.title}": ${backdrop}`);
      }
      await delay(80);
    }
  }

  fs.writeFileSync(DB_FILE, JSON.stringify(items, null, 2), 'utf8');
  console.log(`=== BACKDROP UPDATE COMPLETE: Added ${addedBackdrops} HD backdrops ===`);
}

main().catch(console.error);
