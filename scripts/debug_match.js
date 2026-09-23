const db = require('../src/data/anime-db.json');
const toon = require('./toonstream_catalog_cache.json');

const toonMovies = toon.filter(x => x.type === 'movie');

function normalize(str) {
  return (str || '')
    .toLowerCase()
    .replace(/[''`]/g, '')
    .replace(/\b(season\s*\d+|part\s*\d+|s\d+|cour\s*\d+|dub|sub|hindi|urdu)\b/gi, '')
    .replace(/[^\w\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

// Show sample matches/mismatches
const dbMovies = db.filter(x => x.type === 'movie' && !x.toonStreamUrl);
console.log('DB movies needing ToonStream:', dbMovies.length);
console.log('ToonStream movies:', toonMovies.length);
console.log('\nSample DB movie titles (normalized):');
dbMovies.slice(0, 10).forEach(m => console.log(' ', m.title, '->', normalize(m.title)));

console.log('\nSample ToonStream movie titles (normalized):');
toonMovies.slice(0, 10).forEach(m => console.log(' ', m.title, '->', normalize(m.title)));

// Try to match one specific movie
const test = dbMovies[0];
console.log('\nTrying to match:', test.title, '|', normalize(test.title));
const match = toonMovies.find(t => normalize(t.title) === normalize(test.title));
console.log('Exact match:', match ? match.title : 'none');
const fuzzy = toonMovies.find(t => {
  const nt = normalize(t.title);
  const dt = normalize(test.title);
  return (nt.includes(dt) && dt.length > 5) || (dt.includes(nt) && nt.length > 5);
});
console.log('Fuzzy match:', fuzzy ? fuzzy.title : 'none');
