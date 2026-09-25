const fs = require('fs');
const path = require('path');

const DB_PATH = path.join(__dirname, '..', 'src', 'data', 'anime-db.json');
const CATALOG_PATH = path.join(__dirname, '..', 'src', 'data', 'anime-catalog.json');
const TMDB_KEY = '119b065ce02f9f479565d6b99a758ee2';

const scraped = JSON.parse(fs.readFileSync(path.join(__dirname, 'doraemon_scraped_streams.json'), 'utf8'));

const DEAD_DOMAINS = ['as-cdn', 'streamhide', 'youtube', 'short.icu', 'short.link', 'about:blank', 'hd.'];

function rankStreams(streamList) {
  const valid = streamList.filter(s => {
    if (!s || typeof s !== 'string') return false;
    const l = s.toLowerCase();
    return !DEAD_DOMAINS.some(d => l.includes(d));
  });

  const priority = (url) => {
    const l = url.toLowerCase();
    if (l.includes('filesforever.link')) return 1;
    if (l.includes('abyssplayer.com')) return 2;
    if (l.includes('cloudy.upns.one')) return 3;
    if (l.includes('vidstreaming.xyz')) return 4;
    if (l.includes('vidmoly.net')) return 5;
    if (l.includes('emturbovid.com')) return 6;
    if (l.includes('byselapuix.com')) return 7;
    if (l.includes('streamsb.net')) return 8;
    if (l.includes('rubystm.com')) return 9;
    return 10;
  };

  valid.sort((a, b) => priority(a) - priority(b));
  return [...new Set(valid)];
}

async function fetchTmdb(query, fallbackTitle) {
  try {
    let clean = query
      .replace(/^(Movie|Series|Watch|Free)\s*[:\-]?\s*/gi, '')
      .replace(/\s*\((Hindi|Urdu|Dubbed|Season|Sub|Dual Audio|English|\d{4})[^)]*\)/gi, '')
      .replace(/Hindi Dubbed|Urdu Dubbed|Dual Audio/gi, '')
      .trim();

    // Specific tune for Kachi Kochi
    if (clean.toLowerCase().includes('kachi kochi')) {
      clean = 'Kachi Kochi';
    }

    const url = `https://api.themoviedb.org/3/search/movie?api_key=${TMDB_KEY}&query=${encodeURIComponent(clean)}&include_adult=false`;
    const res = await fetch(url, { signal: AbortSignal.timeout(6000) });
    if (res.ok) {
      const json = await res.json();
      if (json.results && json.results.length > 0) {
        const best = json.results.find(r => r.poster_path && r.backdrop_path) || json.results[0];
        return {
          title: best.title || fallbackTitle,
          poster: best.poster_path ? `https://image.tmdb.org/t/p/w500${best.poster_path}` : null,
          backdrop: best.backdrop_path ? `https://image.tmdb.org/t/p/original${best.backdrop_path}` : null,
          overview: best.overview || '',
          year: best.release_date ? parseInt(best.release_date.split('-')[0], 10) : null,
          rating: best.vote_average ? parseFloat(best.vote_average.toFixed(1)) : 8.2,
        };
      }
    }
  } catch (e) {
    console.error(`TMDB error for "${query}":`, e.message);
  }
  return null;
}

async function main() {
  console.log(`--- PATCHING ALL 21 DORAEMON MOVIES FROM TOONSTREAM ---`);
  const db = JSON.parse(fs.readFileSync(DB_PATH, 'utf8'));

  const toon21Slugs = new Set(scraped.map(s => s.slug));

  const updatedItems = [];

  for (const m of scraped) {
    console.log(`Processing: ${m.title} (${m.slug})`);

    const rankedStreams = rankStreams(m.streams || []);
    if (rankedStreams.length === 0) {
      console.warn(`  WARNING: No valid streams found for ${m.title}`);
      continue;
    }

    const sources = rankedStreams.map((s, idx) => ({
      label: idx === 0 ? 'ToonStream 1 (HD)' : idx === 1 ? 'ToonStream 2 (Fast)' : `ToonStream ${idx + 1} (Mirror)`,
      url: s,
      isMultiAudio: true,
    }));

    const primaryStream = rankedStreams[0];

    // Fetch TMDB
    const tmdb = await fetchTmdb(m.title, m.title);

    // Find existing item in DB
    const existing = db.find(d => d.slug === m.slug || d.saltSlug === m.slug || (d.type === 'movie' && d.title.toLowerCase().replace(/[^a-z0-9]/g, '') === m.title.toLowerCase().replace(/[^a-z0-9]/g, '')));

    const finalTitle = tmdb?.title || existing?.title || m.title;
    const finalPoster = tmdb?.poster || existing?.poster || m.poster || '';
    const finalBackdrop = tmdb?.backdrop || existing?.backdrop || finalPoster;
    const finalDescription = tmdb?.overview || existing?.description || m.description || '';
    const finalYear = tmdb?.year || existing?.year || (m.year ? parseInt(m.year, 10) : 2020);
    const finalRating = tmdb?.rating || existing?.rating || 8.3;

    const item = {
      title: finalTitle,
      slug: m.slug,
      saltSlug: existing?.saltSlug || m.slug,
      toonSlug: m.slug,
      url: m.url,
      toonUrl: m.url,
      type: 'movie',
      poster: finalPoster,
      backdrop: finalBackdrop,
      description: finalDescription,
      genres: ['Animation', 'Comedy', 'Adventure', 'Sci-Fi', 'Fantasy'],
      audioLanguages: ['Hindi', 'Urdu', 'Japanese', 'Tamil', 'Telugu'],
      rating: finalRating,
      year: finalYear,
      streamUrl: primaryStream,
      toonStreamUrl: primaryStream,
      saltStreamUrl: existing?.saltStreamUrl || undefined,
      streamSources: sources,
      source: 'toonstream',
      episodeCount: 1,
      episodesCount: 1,
    };

    console.log(`  -> Streams: ${sources.length} | Primary: ${primaryStream.slice(0, 45)}...`);
    console.log(`  -> Poster: ${finalPoster.slice(0, 50)}...`);
    updatedItems.push(item);
  }

  // Now, in db:
  // Remove all old Doraemon movies (both the 21 and the 17 broken 0-stream ones)
  // And insert the 21 pristine working ToonStream movies!
  const nonDoraemonMoviesAndSeries = db.filter(item => {
    const isDoraemon = item.title.toLowerCase().includes('doraemon') || item.slug.toLowerCase().includes('doraemon');
    if (!isDoraemon) return true;
    // Keep Doraemon series!
    if (item.type === 'series') return true;
    // Remove old movie entry
    return false;
  });

  const finalDb = [...nonDoraemonMoviesAndSeries, ...updatedItems];

  fs.writeFileSync(DB_PATH, JSON.stringify(finalDb, null, 2), 'utf8');
  console.log(`\nUpdated DB: ${finalDb.length} items total (${updatedItems.length} active Doraemon movies).`);

  // Regenerate anime-catalog.json
  console.log('Regenerating anime-catalog.json...');
  const catalog = finalDb.map(item => ({
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
    source: item.source || 'toonstream',
  }));

  fs.writeFileSync(CATALOG_PATH, JSON.stringify(catalog, null, 2), 'utf8');
  console.log(`Saved anime-catalog.json (${catalog.length} items).`);

  // Also update toonstream_movies_scraped.json and toonstream_catalog_cache.json
  try {
    const tsMoviesPath = path.join(__dirname, 'toonstream_movies_scraped.json');
    let tsMovies = [];
    if (fs.existsSync(tsMoviesPath)) {
      tsMovies = JSON.parse(fs.readFileSync(tsMoviesPath, 'utf8'));
    }
    // Update or add the 21 movies
    for (const u of updatedItems) {
      const idx = tsMovies.findIndex(x => x.slug === u.slug);
      if (idx >= 0) {
        tsMovies[idx] = { ...tsMovies[idx], ...u };
      } else {
        tsMovies.push(u);
      }
    }
    fs.writeFileSync(tsMoviesPath, JSON.stringify(tsMovies, null, 2), 'utf8');
    console.log(`Updated toonstream_movies_scraped.json`);
  } catch (e) {
    console.warn(`Could not update toonstream_movies_scraped: ${e.message}`);
  }
}

main().catch(console.error);
