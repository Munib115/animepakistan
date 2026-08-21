const fs = require('fs');
const path = require('path');
const https = require('https');

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
  clean = clean.replace(/\b(hindi\s*dub|hindi\s*sub|dubbed|subbed|multi\s*audio|urdu\s*dub|english\s*dub)\b/gi, ' ');
  clean = clean.replace(/\b(2023|2024|2025|2026)\b/g, ' ');
  // Replace hyphens/underscores with space if needed
  clean = clean.replace(/[-_]/g, ' ');
  // Normalize whitespace
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

// 1. TMDB Search
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
    ].filter(x => x.poster_path);

    if (candidates.length > 0) {
      // Sort by popularity / vote count
      candidates.sort((a, b) => (b.popularity || 0) - (a.popularity || 0));
      const best = candidates[0];
      return {
        poster: `https://image.tmdb.org/t/p/w500${best.poster_path}`,
        backdrop: best.backdrop_path ? `https://image.tmdb.org/t/p/original${best.backdrop_path}` : '',
        title: best.name || best.title || '',
        overview: best.overview || '',
        rating: best.vote_average ? Math.round(best.vote_average * 10) : null,
        releaseDate: best.first_air_date || best.release_date || ''
      };
    }
  } catch (e) {
    // ignore
  }
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
          season
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
      await delay(2500);
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
          season: media.season || '',
          status: media.status || '',
          genres: media.genres || []
        }
      };
    }
  } catch (e) {
    // ignore
  }
  return null;
}

// 3. Kitsu API Search
async function searchKitsu(query) {
  if (!query) return null;
  try {
    const url = `https://kitsu.io/api/edge/anime?filter[text]=${encodeURIComponent(query)}&page[limit]=1`;
    const res = await fetch(url, { headers: { 'Accept': 'application/vnd.api+json' } });
    if (!res.ok) return null;
    const json = await res.json();
    const anime = json.data?.[0]?.attributes;
    if (anime) {
      const poster = anime.posterImage?.large || anime.posterImage?.original || anime.posterImage?.medium || '';
      const banner = anime.coverImage?.large || anime.coverImage?.original || '';
      if (poster) {
        return {
          poster,
          banner,
          englishTitle: anime.titles?.en || anime.titles?.en_jp || '',
          synopsis: anime.synopsis || '',
          rating: anime.averageRating ? Math.round(parseFloat(anime.averageRating)) : null
        };
      }
    }
  } catch (e) {
    // ignore
  }
  return null;
}

// 4. Jikan API (MAL) Search
async function searchJikan(query) {
  if (!query) return null;
  try {
    const url = `https://api.jikan.moe/v4/anime?q=${encodeURIComponent(query)}&limit=1`;
    const res = await fetch(url);
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
  } catch (e) {
    // ignore
  }
  return null;
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

async function findBestPoster(item) {
  const queries = [
    cleanTitle(item.title),
    cleanSlug(item.slug),
    item.anilist?.englishName,
    item.anilist?.romajiName,
    item.title
  ].filter(Boolean).filter((v, i, a) => a.indexOf(v) === i);

  // 1. Try TMDB on all queries
  for (const q of queries) {
    const tmdb = await searchTMDB(q);
    if (tmdb && tmdb.poster) {
      return { poster: tmdb.poster, tmdb, source: 'TMDB' };
    }
    await delay(100);
  }

  // 2. Try AniList on all queries
  for (const q of queries) {
    const anilist = await searchAniList(q);
    if (anilist && anilist.poster) {
      return { poster: anilist.poster, anilistData: anilist.anilistData, source: 'AniList' };
    }
    await delay(200);
  }

  // 3. Try Kitsu
  for (const q of queries) {
    const kitsu = await searchKitsu(q);
    if (kitsu && kitsu.poster) {
      return { poster: kitsu.poster, kitsu, source: 'Kitsu' };
    }
    await delay(150);
  }

  // 4. Try Jikan
  for (const q of queries) {
    const jikan = await searchJikan(q);
    if (jikan && jikan.poster) {
      return { poster: jikan.poster, jikan, source: 'Jikan' };
    }
    await delay(350);
  }

  return null;
}

async function main() {
  console.log('=== STARTING HIGH QUALITY POSTER RESOLVER (TMDB + ANILIST + KITSU) ===');
  const raw = fs.readFileSync(DB_FILE, 'utf8');
  const items = JSON.parse(raw);
  console.log(`Total items in database: ${items.length}`);

  let updatedCount = 0;
  let skippedCount = 0;
  let failedCount = 0;

  for (let i = 0; i < items.length; i++) {
    const item = items[i];
    const needsFix = isBadPoster(item.poster) || !item.anilist;

    if (!needsFix) {
      skippedCount++;
      continue;
    }

    console.log(`\n[${i + 1}/${items.length}] Processing: "${item.title}"`);
    console.log(`  Current poster: ${item.poster || 'NONE'}`);

    const result = await findBestPoster(item);

    if (result && result.poster) {
      item.poster = result.poster;
      if (result.anilistData && !item.anilist) {
        item.anilist = result.anilistData;
      }
      if (result.tmdb && (!item.description || item.description.length < 20) && result.tmdb.overview) {
        item.description = result.tmdb.overview;
      }
      updatedCount++;
      console.log(`  -> SUCCESS [${result.source}]: ${result.poster}`);
    } else {
      failedCount++;
      console.log(`  -> FAILED to find poster`);
    }

    // Save incrementally every 5 updates
    if (updatedCount % 5 === 0 && updatedCount > 0) {
      fs.writeFileSync(DB_FILE, JSON.stringify(items, null, 2), 'utf8');
      console.log(`  [Progress Saved: ${updatedCount} updated]`);
    }

    await delay(120);
  }

  fs.writeFileSync(DB_FILE, JSON.stringify(items, null, 2), 'utf8');
  console.log(`\n=== COMPLETE ===`);
  console.log(`Updated: ${updatedCount}, Skipped: ${skippedCount}, Failed: ${failedCount}`);
}

main().catch(console.error);
