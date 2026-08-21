const db = require('../src/data/anime-db.json');

console.log('Searching for Ben 10, Doraemon, or weird title/poster mismatches:');
db.forEach((item, idx) => {
  const t = (item.title || '').toLowerCase();
  const an = (item.anilist?.englishName || '').toLowerCase();
  const ar = (item.anilist?.romajiName || '').toLowerCase();
  const p = (item.poster || '').toLowerCase();

  // Check if Ben 10 has Doraemon or vice versa
  if (t.includes('ben 10') || t.includes('benten') || t.includes('doraemon') || t.includes('shinchan')) {
    console.log(`[${idx}] Title: ${item.title} | Slug: ${item.slug} | Type: ${item.type} | AniList: ${item.anilist?.englishName || item.anilist?.romajiName || 'NONE'}`);
    console.log(`     Poster: ${item.poster}`);
    if (item.episodes && item.episodes.length > 0) {
      console.log(`     First Ep: ${item.episodes[0].title} -> ${item.episodes[0].url}`);
    }
  }
});
