const fs = require('fs');
const path = require('path');

const DB_PATH = path.join(__dirname, '../src/data/anime-db.json');
const CATALOG_PATH = path.join(__dirname, '../src/data/anime-catalog.json');

const db = JSON.parse(fs.readFileSync(DB_PATH, 'utf8'));
const moviesScraped = JSON.parse(fs.readFileSync(path.join(__dirname, 'toonstream_movies_scraped.json'), 'utf8'));
const seriesMeta = JSON.parse(fs.readFileSync(path.join(__dirname, 'toonstream_series_meta.json'), 'utf8'));

let episodeStreams = {};
const epStreamPath = path.join(__dirname, 'toonstream_episode_streams_cache.json');
if (fs.existsSync(epStreamPath)) {
  try {
    episodeStreams = JSON.parse(fs.readFileSync(epStreamPath, 'utf8'));
  } catch (e) {}
}

function normalize(str) {
  return (str || '')
    .toLowerCase()
    .replace(/\b(season\s*\d+|part\s*\d+|s\d+|cour\s*\d+|dub|sub)\b/gi, '')
    .replace(/[^\w\s]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

console.log(`Current AnimePakistan DB: ${db.length} entries`);
console.log(`ToonStream Movies: ${moviesScraped.length}`);
console.log(`ToonStream Series: ${seriesMeta.length}`);
console.log(`Cached Episode Streams: ${Object.keys(episodeStreams).length}`);

// Index DB by slug and saltSlug
const dbBySlug = new Map();
const dbByNormTitle = new Map();

for (const item of db) {
  dbBySlug.set(item.slug.toLowerCase(), item);
  if (item.saltSlug) dbBySlug.set(item.saltSlug.toLowerCase(), item);
  const norm = normalize(item.title);
  if (norm) dbByNormTitle.set(norm, item);
}

function findDbMatch(item) {
  const bySlug = dbBySlug.get(item.slug.toLowerCase());
  if (bySlug) return bySlug;

  const norm = normalize(item.title);
  if (dbByNormTitle.has(norm)) return dbByNormTitle.get(norm);

  // Partial match fallback
  for (const [dNorm, dItem] of dbByNormTitle.entries()) {
    if (dNorm.length > 5 && (dNorm.includes(norm) || norm.includes(dNorm))) {
      return dItem;
    }
  }
  return null;
}

// 1. Process Movies
let updatedMovies = 0;
let newMoviesAdded = 0;
const processedToonUrls = new Set();

for (const movie of moviesScraped) {
  processedToonUrls.add(movie.url);
  const match = findDbMatch(movie);

  if (match) {
    // Preserve existing AnimeSalt link!
    if (match.streamUrl && !match.saltStreamUrl && match.streamUrl.includes('as-cdn')) {
      match.saltStreamUrl = match.streamUrl;
    }
    match.toonUrl = movie.url;
    match.toonSlug = movie.slug;
    match.toonStreamUrl = movie.toonStreamUrl || movie.streamUrl;

    // Use active working ToonStream stream as primary
    if (movie.streamUrl) {
      match.streamUrl = movie.streamUrl;
    }
    if (movie.streamSources && movie.streamSources.length > 0) {
      // Ensure AnimeSalt backup is present in streamSources if available
      const sources = [...movie.streamSources];
      if (match.saltStreamUrl && !sources.some(s => s.url === match.saltStreamUrl)) {
        sources.push({
          label: 'AnimeSalt (Backup)',
          url: match.saltStreamUrl,
          isMultiAudio: true
        });
      }
      match.streamSources = sources;
    }
    updatedMovies++;
  } else {
    // Brand new movie from ToonStream!
    const newEntry = {
      title: movie.title,
      slug: movie.slug,
      type: 'movie',
      poster: movie.poster,
      backdrop: movie.poster,
      description: movie.description,
      genres: movie.genres,
      audioLanguages: ['Hindi', 'Urdu', 'English', 'Japanese'],
      rating: movie.rating || 8.0,
      year: 2024,
      url: movie.url,
      toonUrl: movie.url,
      toonSlug: movie.slug,
      streamUrl: movie.streamUrl,
      toonStreamUrl: movie.toonStreamUrl,
      streamSources: movie.streamSources,
      source: 'toonstream'
    };
    db.push(newEntry);
    dbBySlug.set(newEntry.slug.toLowerCase(), newEntry);
    dbByNormTitle.set(normalize(newEntry.title), newEntry);
    newMoviesAdded++;
  }
}

// 2. Process Series
let updatedSeries = 0;
let updatedEpisodes = 0;
let newSeriesAdded = 0;

for (const series of seriesMeta) {
  processedToonUrls.add(series.url);
  const match = findDbMatch(series);

  if (match && match.type === 'series') {
    match.toonUrl = series.url;
    match.toonSlug = series.slug;

    // Merge episodes
    if (match.episodes && series.episodes) {
      for (const ep of match.episodes) {
        // Preserve existing AnimeSalt stream!
        if (ep.streamUrl && !ep.saltStreamUrl && ep.streamUrl.includes('as-cdn')) {
          ep.saltStreamUrl = ep.streamUrl;
        }
        if (ep.url && !ep.saltUrl && ep.url.includes('animesalt')) {
          ep.saltUrl = ep.url;
        }

        // Match episode from series.episodes by season and number
        const matchedEp = series.episodes.find(se => se.season === ep.season && se.number === ep.number)
          || series.episodes.find(se => se.number === ep.number);

        if (matchedEp) {
          ep.toonUrl = matchedEp.url;
          ep.toonSlug = matchedEp.slug;

          const streamData = episodeStreams[matchedEp.url];
          if (streamData && streamData.streamUrl) {
            ep.toonStreamUrl = streamData.toonStreamUrl || streamData.streamUrl;
            ep.streamUrl = streamData.streamUrl;

            const sources = [...streamData.streamSources];
            if (ep.saltStreamUrl && !sources.some(s => s.url === ep.saltStreamUrl)) {
              sources.push({
                label: 'AnimeSalt (Backup)',
                url: ep.saltStreamUrl,
                isMultiAudio: true
              });
            }
            ep.streamSources = sources;
            updatedEpisodes++;
          }
        }
      }
    }
    updatedSeries++;
  } else if (!match) {
    // Brand new series from ToonStream!
    const newEpisodes = series.episodes.map(ep => {
      const streamData = episodeStreams[ep.url];
      return {
        number: ep.number,
        season: ep.season,
        title: ep.title,
        slug: ep.slug,
        url: ep.url,
        toonUrl: ep.url,
        thumbnail: ep.thumbnail,
        streamUrl: streamData?.streamUrl || '',
        toonStreamUrl: streamData?.toonStreamUrl || '',
        streamSources: streamData?.streamSources || []
      };
    });

    const newSeriesEntry = {
      title: series.title,
      slug: series.slug,
      type: 'series',
      poster: series.poster,
      backdrop: series.poster,
      description: series.description,
      genres: series.genres,
      audioLanguages: ['Hindi', 'Urdu', 'English', 'Japanese'],
      rating: series.rating || 8.0,
      year: 2024,
      url: series.url,
      toonUrl: series.url,
      toonSlug: series.slug,
      episodes: newEpisodes,
      episodeCount: newEpisodes.length,
      source: 'toonstream'
    };
    db.push(newSeriesEntry);
    dbBySlug.set(newSeriesEntry.slug.toLowerCase(), newSeriesEntry);
    dbByNormTitle.set(normalize(newSeriesEntry.title), newSeriesEntry);
    newSeriesAdded++;
  }
}

console.log(`\n================ INTEGRATION SUMMARY ================`);
console.log(`Movies matched and updated with ToonStream streams: ${updatedMovies}`);
console.log(`New Movies added to catalog: ${newMoviesAdded}`);
console.log(`Series matched and updated: ${updatedSeries}`);
console.log(`Series episodes with pre-cached ToonStream streams: ${updatedEpisodes}`);
console.log(`New Series added to catalog: ${newSeriesAdded}`);
console.log(`Total database items now: ${db.length}`);

// Write updated DB
fs.writeFileSync(DB_PATH, JSON.stringify(db, null, 2));
console.log(`Updated database saved to: ${DB_PATH}`);

// Generate updated lightweight catalog
const catalog = db.map(item => ({
  id: item.id || `ap-${item.slug}`,
  title: item.title,
  slug: item.slug,
  saltSlug: item.saltSlug || undefined,
  toonSlug: item.toonSlug || undefined,
  type: item.type,
  poster: item.poster,
  backdrop: item.backdrop || item.poster,
  rating: item.rating || 8.0,
  year: item.year || 2024,
  genres: item.genres || ['Anime'],
  audioLanguages: item.audioLanguages || ['Hindi', 'Urdu'],
  episodesCount: item.type === 'series' ? (item.episodes?.length || 0) : undefined,
  hasStreams: item.type === 'movie' ? !!item.streamUrl : (item.episodes?.some(e => !!e.streamUrl) ?? false)
}));

fs.writeFileSync(CATALOG_PATH, JSON.stringify(catalog, null, 2));
console.log(`Updated catalog saved to: ${CATALOG_PATH}`);
