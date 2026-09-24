const fs = require('fs');
const path = require('path');

const DB_PATH = path.join(__dirname, '..', 'src', 'data', 'anime-db.json');
const CATALOG_PATH = path.join(__dirname, '..', 'src', 'data', 'anime-catalog.json');

console.log('Loading database...');
const db = JSON.parse(fs.readFileSync(DB_PATH, 'utf8'));

let episodesUpdated = 0;
let moviesUpdated = 0;

db.forEach(item => {
  // If it's a movie
  if (item.type === 'movie') {
    if (item.streamSources && item.streamSources.length > 0) {
      item.streamSources = item.streamSources.map(s => {
        if (s.label && s.label.includes('(Backup)')) {
          return { ...s, label: s.label.replace(' (Backup)', ' (HD)') };
        }
        return s;
      }).sort((a, b) => {
        const aIsSalt = (a.label?.includes('AnimeSalt') || a.url?.includes('as-cdn') || a.url?.includes('animesalt')) ? -1 : 1;
        const bIsSalt = (b.label?.includes('AnimeSalt') || b.url?.includes('as-cdn') || b.url?.includes('animesalt')) ? -1 : 1;
        return aIsSalt - bIsSalt;
      });
      moviesUpdated++;
    }
  }

  // If it has episodes
  if (item.episodes && item.episodes.length > 0) {
    item.episodes.forEach(ep => {
      if (ep.streamSources && ep.streamSources.length > 0) {
        ep.streamSources = ep.streamSources.map(s => {
          if (s.label && s.label.includes('(Backup)')) {
            return { ...s, label: s.label.replace(' (Backup)', ' (HD)') };
          }
          return s;
        }).sort((a, b) => {
          const aIsSalt = (a.label?.includes('AnimeSalt') || a.url?.includes('as-cdn') || a.url?.includes('animesalt')) ? -1 : 1;
          const bIsSalt = (b.label?.includes('AnimeSalt') || b.url?.includes('as-cdn') || b.url?.includes('animesalt')) ? -1 : 1;
          return aIsSalt - bIsSalt;
        });
        episodesUpdated++;
      }
    });
  }
});

console.log(`Re-prioritized AnimeSalt streams: ${moviesUpdated} movies and ${episodesUpdated} episodes updated!`);

fs.writeFileSync(DB_PATH, JSON.stringify(db, null, 2), 'utf8');
console.log('Saved anime-db.json successfully.');

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
