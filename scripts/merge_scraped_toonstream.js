const fs = require('fs');
const path = require('path');

const DB_PATH = path.join(__dirname, '..', 'src', 'data', 'anime-db.json');
const CATALOG_PATH = path.join(__dirname, '..', 'src', 'data', 'anime-catalog.json');
const TOON_PATH = path.join(__dirname, '..', 'src', 'data', 'toonstream-scraped.json');

if (!fs.existsSync(TOON_PATH)) {
  console.log('No toonstream-scraped.json found yet.');
  process.exit(0);
}

const db = JSON.parse(fs.readFileSync(DB_PATH, 'utf8'));
const toonItems = JSON.parse(fs.readFileSync(TOON_PATH, 'utf8'));

console.log(`Current DB size: ${db.length} titles`);
console.log(`ToonStream scraped items: ${toonItems.length}`);

const existingSlugs = new Set(db.map(a => a.slug.toLowerCase().trim()));
let addedCount = 0;
let addedEpisodes = 0;

for (const item of toonItems) {
  if (!existingSlugs.has(item.slug.toLowerCase().trim())) {
    existingSlugs.add(item.slug.toLowerCase().trim());
    db.push(item);
    addedCount++;
    if (item.episodes) addedEpisodes += item.episodes.length;
  }
}

console.log(`Added ${addedCount} new anime titles (${addedEpisodes} episodes) to DB!`);
console.log(`New DB total: ${db.length} titles`);

// Save updated DB
fs.writeFileSync(DB_PATH, JSON.stringify(db, null, 2));
console.log('Saved updated anime-db.json');

// Regenerate fast catalog
const catalog = db.map(item => ({
  id: item.id || item.slug,
  title: item.title,
  slug: item.slug,
  saltSlug: item.saltSlug || item.slug,
  type: item.type || 'series',
  poster: item.poster || '',
  backdrop: item.backdrop || item.poster || '',
  genres: item.genres || ['Anime'],
  rating: item.rating || 8.0,
  year: item.year || 2023,
  episodeCount: item.type === 'movie' ? 1 : (item.episodes ? item.episodes.length : 1),
  source: item.source || 'animesalt'
}));

fs.writeFileSync(CATALOG_PATH, JSON.stringify(catalog, null, 2));
console.log(`Regenerated anime-catalog.json with ${catalog.length} items`);
