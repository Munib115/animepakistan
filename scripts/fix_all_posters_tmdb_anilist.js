const fs = require('fs');
const path = require('path');

const DB_FILE = path.join(__dirname, '..', 'src', 'data', 'anime-db.json');
const TMDB_KEY = '119b065ce02f9f479565d6b99a758ee2';

const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

function cleanTitle(raw) {
  if (!raw) return '';
  let clean = decodeURIComponent(raw);
  // Replace ½ or %c2%bd with 1/2
  clean = clean.replace(/½|%c2%bd/gi, ' 1/2 ');
  // Remove brackets and parentheses
  clean = clean.replace(/\([^)]*\)/g, ' ');
  clean = clean.replace(/\[[^\]]*\]/g, ' ');
  // Remove seasons, dub, language tags
  clean = clean.replace(/\b(season\s*\d+|part\s*\d+|cour\s*\d+|s\d+|2nd\s*season|3rd\s*season|4th\s*season|the\s*final\s*season)\b/gi, ' ');
  clean = clean.replace(/\b(hindi\s*dub|hindi\s*sub|dubbed|subbed|multi\s*audio|urdu\s*dub|english\s*dub|all\s*episodes)\b/gi, ' ');
  clean = clean.replace(/\b(2023|2024|2025|2026)\b/g, ' ');
  clean = clean.replace(/[-_]/g, ' ');
  clean = clean.replace(/\s+/g, ' ').trim();
  return clean;
}

function cleanSlug(slug) {
  if (!slug) return '';
  let s = decodeURIComponent(slug);
  s = s.replace(/%c2%bd/gi, ' 1-2 ');
  s = s.replace(/-(2023|2024|2025|2026)/g, '');
  s = s.replace(/-(season-\d+|part-\d+|s\d+|cour-\d+)/gi, '');
  s = s.replace(/-(hindi|urdu|dubbed|subbed|multi)/gi, '');
  s = s.replace(/-/g, ' ').trim();
  return s;
}

function isBadPoster(url) {
  if (!url) return true;
  const lower = url.toLowerCase();
  return (
    lower.includes('animesalt.link') ||
    lower.includes('thumb_') ||
    lower.includes('/image/') ||
    lower.includes('images-unified') ||
    lower.includes('animesaltlong') ||
    lower.includes('data:image') ||
    lower.includes('/w185/') ||
    lower.includes('/w92/')
  );
}

// 1. TMDB Search (TV & Movie)
async function searchTMDB(query) {
  if (!query) return null;
  try {
    const encoded = encodeURIComponent(query);
    const tvUrl = `https://api.themoviedb.org/3/search/tv?api_key=${TMDB_KEY}&query=${encoded}&include_adult=false`;
    const movUrl = `https://api.themoviedb.org/3/search/movie?api_key=${TMDB_KEY}&query=${encoded}&include_adult=false`;

    const [tvRes, movRes] = await Promise.all([
      fetch(tvUrl, { headers: { 'User-Agent': 'Mozilla/5.0' } }).then(r => r.json()).catch(() => ({ results: [] })),
      fetch(movUrl, { headers: { 'User-Agent': 'Mozilla/5.0' } }).then(r => r.json()).catch(() => ({ results: [] }))
    ]);

    const candidates = [
      ...(tvRes.results || []),
      ...(movRes.results || [])
    ].filter(x => x && x.poster_path);

    if (candidates.length > 0) {
      // Sort by popularity
      candidates.sort((a, b) => (b.popularity || 0) - (a.popularity || 0));
      const best = candidates[0];
      return {
        poster: `https://image.tmdb.org/t/p/w500${best.poster_path}`,
        backdrop: best.backdrop_path ? `https://image.tmdb.org/t/p/original${best.backdrop_path}` : '',
        title: best.name || best.title || '',
        overview: best.overview || '',
        rating: best.vote_average ? Math.round(best.vote_average * 10) : null
      };
    }
  } catch (e) {}
  return null;
}

// 2. AniList GraphQL Search
async function searchAniList(query) {
  if (!query) return null;
  const graphqlQuery = JSON.stringify({
    query: `
      query ($search: String) {
        Media(search: $search, type: ANIME) {
          id
          title {
            romaji
            english
            native
          }
          coverImage {
            extraLarge
            large
          }
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
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
        'User-Agent': 'Mozilla/5.0'
      },
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
      if (poster) {
        return {
          poster,
          bannerImage: media.bannerImage || '',
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
    }
  } catch (e) {}
  return null;
}

// 3. Jikan API (MAL) Search
async function searchJikan(query) {
  if (!query) return null;
  try {
    const url = `https://api.jikan.moe/v4/anime?q=${encodeURIComponent(query)}&limit=1`;
    const res = await fetch(url, { headers: { 'User-Agent': 'Mozilla/5.0' } });
    if (!res.ok) return null;
    const json = await res.json();
    const anime = json.data?.[0];
    if (anime) {
      const poster = anime.images?.webp?.large_image_url || anime.images?.jpg?.large_image_url || '';
      if (poster) {
        return {
          poster,
          title: anime.title_english || anime.title || '',
          rating: anime.score ? Math.round(anime.score * 10) : null
        };
      }
    }
  } catch (e) {}
  return null;
}

async function resolvePoster(item) {
  const queries = [
    cleanTitle(item.title),
    cleanSlug(item.slug),
    item.anilist?.englishName,
    item.anilist?.romajiName,
    item.title
  ].filter(Boolean).filter((v, i, a) => a.indexOf(v) === i);

  // Phase 1: Search TMDB
  for (const q of queries) {
    const tmdb = await searchTMDB(q);
    if (tmdb && tmdb.poster) {
      return { poster: tmdb.poster, tmdb, source: 'TMDB' };
    }
  }

  // Phase 2: Search AniList
  for (const q of queries) {
    const anilist = await searchAniList(q);
    if (anilist && anilist.poster) {
      return { poster: anilist.poster, anilistData: anilist.anilistData, source: 'AniList' };
    }
  }

  // Phase 3: Search Jikan (MyAnimeList)
  for (const q of queries) {
    const jikan = await searchJikan(q);
    if (jikan && jikan.poster) {
      return { poster: jikan.poster, jikan, source: 'MAL/Jikan' };
    }
  }

  return null;
}

async function main() {
  console.log('=== TARGETED HIGH-RES POSTER FIXER ===');
  const raw = fs.readFileSync(DB_FILE, 'utf8');
  const items = JSON.parse(raw);
  
  const toFix = [];
  for (let i = 0; i < items.length; i++) {
    if (isBadPoster(items[i].poster)) {
      toFix.push({ index: i, item: items[i] });
    }
  }

  console.log(`Found ${toFix.length} anime items with bad/scraped episode thumbnails.`);

  let fixed = 0;
  let failed = 0;

  // Process in small concurrent batches of 4
  const BATCH_SIZE = 4;
  for (let b = 0; b < toFix.length; b += BATCH_SIZE) {
    const batch = toFix.slice(b, b + BATCH_SIZE);
    
    await Promise.all(batch.map(async ({ index, item }) => {
      console.log(`[${index + 1}/${items.length}] Fixing: "${item.title}"`);
      const res = await resolvePoster(item);
      if (res && res.poster) {
        items[index].poster = res.poster;
        if (res.anilistData && !items[index].anilist) {
          items[index].anilist = res.anilistData;
        }
        if (res.tmdb && (!items[index].description || items[index].description.length < 20) && res.tmdb.overview) {
          items[index].description = res.tmdb.overview;
        }
        fixed++;
        console.log(`  -> OK [${res.source}]: ${res.poster}`);
      } else {
        failed++;
        console.log(`  -> FAILED for "${item.title}" (slug: ${item.slug})`);
      }
    }));

    // Save every batch
    fs.writeFileSync(DB_FILE, JSON.stringify(items, null, 2), 'utf8');
    await delay(250);
  }

  console.log(`\n=== FIX COMPLETED ===`);
  console.log(`Total fixed: ${fixed}`);
  console.log(`Total failed: ${failed}`);
}

main().catch(console.error);
