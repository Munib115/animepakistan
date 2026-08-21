const fs = require('fs');
const path = require('path');

const DB_FILE = path.join(__dirname, '..', 'src', 'data', 'anime-db.json');
const TMDB_KEY = '119b065ce02f9f479565d6b99a758ee2';

const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

function cleanQuery(str) {
  if (!str) return '';
  let s = decodeURIComponent(str);
  s = s.replace(/½|%c2%bd/gi, ' 1/2 ');
  s = s.replace(/\([^)]*\)/g, ' ');
  s = s.replace(/\[[^\]]*\]/g, ' ');
  s = s.replace(/\b(hindi|urdu|tamil|telugu|bengali|malayalam|kannada|dubbed|dub|sub|multi|audio)\b/gi, ' ');
  s = s.replace(/[-_]/g, ' ');
  s = s.replace(/\s+/g, ' ').trim();
  return s;
}

async function searchTMDB(query, type) {
  if (!query) return null;
  try {
    const encoded = encodeURIComponent(query);
    const tvUrl = `https://api.themoviedb.org/3/search/tv?api_key=${TMDB_KEY}&query=${encoded}&include_adult=false`;
    const movUrl = `https://api.themoviedb.org/3/search/movie?api_key=${TMDB_KEY}&query=${encoded}&include_adult=false`;

    const [tvRes, movRes] = await Promise.all([
      fetch(tvUrl).then(r => r.json()).catch(() => ({ results: [] })),
      fetch(movUrl).then(r => r.json()).catch(() => ({ results: [] }))
    ]);

    let results = [];
    if (type === 'movie') {
      results = [...(movRes.results || []), ...(tvRes.results || [])];
    } else {
      results = [...(tvRes.results || []), ...(movRes.results || [])];
    }

    results = results.filter(x => x && x.poster_path);
    if (results.length > 0) {
      return {
        poster: `https://image.tmdb.org/t/p/w500${results[0].poster_path}`,
        backdrop: results[0].backdrop_path ? `https://image.tmdb.org/t/p/original${results[0].backdrop_path}` : '',
        title: results[0].name || results[0].title || '',
        overview: results[0].overview || '',
        rating: results[0].vote_average ? Math.round(results[0].vote_average * 10) : null
      };
    }
  } catch (e) {}
  return null;
}

async function searchAniList(query) {
  if (!query) return null;
  const graphqlQuery = JSON.stringify({
    query: `
      query ($search: String) {
        Media(search: $search, type: ANIME) {
          id
          title { romaji english native }
          coverImage { extraLarge large }
          bannerImage
          description
          averageScore
          seasonYear
          status
          genres
        }
      }
    `,
    variables: { search: query }
  });

  try {
    const res = await fetch('https://graphql.anilist.co', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Accept': 'application/json', 'User-Agent': 'Mozilla/5.0' },
      body: graphqlQuery
    });
    if (res.status === 429) {
      await delay(2000);
      return null;
    }
    if (!res.ok) return null;
    const json = await res.json();
    const media = json.data?.Media;
    if (media) {
      const poster = media.coverImage?.extraLarge || media.coverImage?.large || '';
      return {
        poster,
        anilistData: {
          id: media.id,
          romajiName: media.title?.romaji || '',
          englishName: media.title?.english || '',
          nativeName: media.title?.native || '',
          description: media.description || '',
          coverImage: poster,
          bannerImage: media.bannerImage || '',
          rating: media.averageScore || null,
          year: media.seasonYear || null,
          status: media.status || '',
          genres: media.genres || []
        }
      };
    }
  } catch (e) {}
  return null;
}

async function run() {
  console.log('=== VERIFYING AND RE-MATCHING ALL 510 ITEMS WITH TMDB & ANILIST ===');
  const items = JSON.parse(fs.readFileSync(DB_FILE, 'utf8'));
  
  let updated = 0;
  const BATCH_SIZE = 5;

  for (let i = 0; i < items.length; i += BATCH_SIZE) {
    const batch = items.slice(i, i + BATCH_SIZE);

    await Promise.all(batch.map(async (item, bIdx) => {
      const globalIdx = i + bIdx;
      const cleanT = cleanQuery(item.title);
      const cleanS = cleanQuery(item.slug);

      // Try TMDB
      let tmdb = await searchTMDB(cleanT, item.type);
      if (!tmdb) tmdb = await searchTMDB(cleanS, item.type);

      if (tmdb && tmdb.poster) {
        item.poster = tmdb.poster;
        if (tmdb.overview && (!item.description || item.description.length < 20)) {
          item.description = tmdb.overview;
        }
        updated++;
        console.log(`[${globalIdx + 1}/${items.length}] Matched TMDB: "${item.title}" -> ${tmdb.title} (${tmdb.poster})`);
        return;
      }

      // Try AniList
      let ani = await searchAniList(cleanT);
      if (!ani) ani = await searchAniList(cleanS);

      if (ani && ani.poster) {
        item.poster = ani.poster;
        if (ani.anilistData && !item.anilist) {
          item.anilist = ani.anilistData;
        }
        updated++;
        console.log(`[${globalIdx + 1}/${items.length}] Matched AniList: "${item.title}" -> ${ani.anilistData?.romajiName || ani.anilistData?.englishName} (${ani.poster})`);
      }
    }));

    if (i % 25 === 0) {
      fs.writeFileSync(DB_FILE, JSON.stringify(items, null, 2), 'utf8');
    }
    await delay(200);
  }

  fs.writeFileSync(DB_FILE, JSON.stringify(items, null, 2), 'utf8');
  console.log(`=== COMPLETE: Re-matched and verified ${updated} items ===`);
}

run().catch(console.error);
