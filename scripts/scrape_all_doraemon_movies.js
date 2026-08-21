const fs = require('fs');
const path = require('path');
const https = require('https');

const DB_PATH = path.join(__dirname, '..', 'src', 'data', 'anime-db.json');
const TMDB_KEY = '119b065ce02f9f479565d6b99a758ee2';

function fetchUrl(url, timeout = 12000) {
  return new Promise((resolve, reject) => {
    const req = https.get(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Referer': 'https://animesalt.link/',
      }
    }, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => resolve(data));
    });
    req.on('error', reject);
    req.setTimeout(timeout, () => {
      req.destroy();
      reject(new Error(`Timeout fetching ${url}`));
    });
  });
}

async function searchTmdb(title) {
  try {
    const clean = title
      .replace(/^(Movie|Series|Watch|Free)\s*[:\-]?\s*/gi, '')
      .replace(/\s*\((Hindi|Urdu|Dubbed|Season|Sub|Dual Audio|English)[^)]*\)/gi, '')
      .replace(/Hindi Dubbed|Urdu Dubbed|Dual Audio/gi, '')
      .trim();
    const url = `https://api.themoviedb.org/3/search/multi?api_key=${TMDB_KEY}&query=${encodeURIComponent(clean)}&include_adult=false`;
    const json = JSON.parse(await fetchUrl(url));
    if (json.results && json.results.length > 0) {
      const best = json.results.find(r => r.poster_path) || json.results[0];
      return {
        poster: best.poster_path ? `https://image.tmdb.org/t/p/w500${best.poster_path}` : null,
        backdrop: best.backdrop_path ? `https://image.tmdb.org/t/p/original${best.backdrop_path}` : null,
        overview: best.overview || '',
        title: best.title || best.name || clean,
      };
    }
  } catch (e) {
    // ignore
  }
  return null;
}

async function enrichDoraemon() {
  console.log('--- ENRICHING ALL DORAEMON MOVIES & SERIES ---');
  const db = JSON.parse(fs.readFileSync(DB_PATH, 'utf-8'));
  const doraemonItems = db.filter(i => i.title.toLowerCase().includes('doraemon') || i.slug.toLowerCase().includes('doraemon'));

  console.log(`Found ${doraemonItems.length} Doraemon movies and series in database.`);

  for (const item of doraemonItems) {
    if (!item.poster || item.poster.includes('animesalt') || !item.backdrop) {
      console.log(`Fetching TMDB metadata for: ${item.title}`);
      const tmdb = await searchTmdb(item.title);
      if (tmdb) {
        if (tmdb.poster) item.poster = tmdb.poster;
        if (tmdb.backdrop) item.backdrop = tmdb.backdrop;
        if (tmdb.overview && (!item.description || item.description.length < 50)) {
          item.description = tmdb.overview;
        }
        if (!item.audioLanguages || item.audioLanguages.length === 0) {
          item.audioLanguages = ['Hindi', 'Urdu', 'Japanese'];
        }
        console.log(`  -> Poster: ${item.poster}`);
        console.log(`  -> Backdrop: ${item.backdrop}`);
      }
    }
  }

  fs.writeFileSync(DB_PATH, JSON.stringify(db, null, 2), 'utf-8');
  console.log('--- DORAEMON ENRICHMENT COMPLETE ---');
}

enrichDoraemon().catch(console.error);
