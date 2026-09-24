const fs = require('fs');
const path = require('path');

const DB_PATH = path.join(__dirname, '..', 'src', 'data', 'anime-db.json');
const CATALOG_PATH = path.join(__dirname, '..', 'src', 'data', 'anime-catalog.json');

console.log('Loading anime-db.json...');
const db = JSON.parse(fs.readFileSync(DB_PATH, 'utf8'));

let episodesUpdated = 0;
let moviesUpdated = 0;
let deadLinksRemoved = 0;

function isDeadUrl(url) {
  if (!url || typeof url !== 'string') return true;
  // as-cdn*.top are dead Cloudflare 522
  if (url.includes('as-cdn') && !url.includes('multi-lang-plyr')) return true;
  return false;
}

function isToonStreamSource(source) {
  const url = source?.url || '';
  const label = source?.label || '';
  if (label.toLowerCase().includes('toonstream')) return true;
  if (url.includes('rubystm') || url.includes('abyss') || url.includes('filesforever') ||
      url.includes('cloudy') || url.includes('strmup') || url.includes('emturbovid') ||
      url.includes('player.toonstream') || url.includes('play.toonstream')) {
    return true;
  }
  return false;
}

function cleanAndPrioritizeSources(sources, fallbackToonUrl) {
  if (!sources || !Array.isArray(sources)) sources = [];

  // Filter out dead links
  let filtered = sources.filter(s => {
    if (isDeadUrl(s?.url)) {
      deadLinksRemoved++;
      return false;
    }
    return true;
  });

  // If we have a fallback ToonStream url not already present, add it
  if (fallbackToonUrl && !isDeadUrl(fallbackToonUrl) && !filtered.some(s => s.url === fallbackToonUrl)) {
    filtered.unshift({
      label: 'ToonStream 1 (HD)',
      url: fallbackToonUrl,
      isMultiAudio: true
    });
  }

  // Sort ToonStream / non-AnimeSalt sources FIRST
  filtered.sort((a, b) => {
    const aIsToon = isToonStreamSource(a) ? -1 : 1;
    const bIsToon = isToonStreamSource(b) ? -1 : 1;
    return aIsToon - bIsToon;
  });

  // Re-label properly
  let toonIdx = 1;
  let saltIdx = 1;
  filtered = filtered.map(s => {
    if (isToonStreamSource(s)) {
      const label = toonIdx === 1 ? 'ToonStream 1 (HD)' : `ToonStream ${toonIdx} (Fast)`;
      toonIdx++;
      return { ...s, label, isMultiAudio: true };
    } else {
      const label = saltIdx === 1 ? 'AnimeSalt (Backup)' : `AnimeSalt Mirror ${saltIdx}`;
      saltIdx++;
      return { ...s, label, isMultiAudio: true };
    }
  });

  return filtered;
}

db.forEach(item => {
  // If Movie
  if (item.type === 'movie') {
    const fallbackToon = item.toonStreamUrl || (item.streamUrl && !isDeadUrl(item.streamUrl) && isToonStreamSource({ url: item.streamUrl }) ? item.streamUrl : null);
    item.streamSources = cleanAndPrioritizeSources(item.streamSources, fallbackToon);

    // Ensure primary streamUrl points to best ToonStream source
    const bestSource = item.streamSources.find(s => isToonStreamSource(s)) || item.streamSources[0];
    if (bestSource && bestSource.url) {
      item.streamUrl = bestSource.url;
    } else if (isDeadUrl(item.streamUrl)) {
      item.streamUrl = '';
    }
    moviesUpdated++;
  }

  // If Series
  if (item.episodes && item.episodes.length > 0) {
    item.episodes.forEach(ep => {
      const fallbackToon = ep.toonStreamUrl || (ep.streamUrl && !isDeadUrl(ep.streamUrl) && isToonStreamSource({ url: ep.streamUrl }) ? ep.streamUrl : null);
      ep.streamSources = cleanAndPrioritizeSources(ep.streamSources, fallbackToon);

      const bestSource = ep.streamSources.find(s => isToonStreamSource(s)) || ep.streamSources[0];
      if (bestSource && bestSource.url) {
        ep.streamUrl = bestSource.url;
      } else if (isDeadUrl(ep.streamUrl)) {
        ep.streamUrl = '';
      }
      episodesUpdated++;
    });
  }
});

console.log(`Removed ${deadLinksRemoved} dead as-cdn links.`);
console.log(`Re-prioritized ToonStream streams across ${moviesUpdated} movies and ${episodesUpdated} episodes.`);

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
  audioLanguages: item.audioLanguages || ['Hindi', 'Urdu'],
  rating: item.rating || 8.0,
  year: item.year || 2024,
  episodeCount: item.type === 'movie' ? 1 : (item.episodes ? item.episodes.length : 1),
  episodesCount: item.type === 'movie' ? 1 : (item.episodes ? item.episodes.length : 1),
  hasStreams: item.type === 'movie'
    ? !!(item.streamUrl || (item.streamSources && item.streamSources.length > 0))
    : (item.episodes?.some(e => !!(e.streamUrl || (e.streamSources && e.streamSources.length > 0))) ?? false),
  source: 'toonstream'
}));

fs.writeFileSync(CATALOG_PATH, JSON.stringify(catalog, null, 2), 'utf8');
console.log(`Saved anime-catalog.json (${catalog.length} items).`);
