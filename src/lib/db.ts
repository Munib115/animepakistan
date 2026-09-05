import fs from 'fs';
import path from 'path';
import { AnimeItem } from '@/types/anime';

let cachedDb: AnimeItem[] | null = null;
let cachedCatalog: AnimeItem[] | null = null;

function loadDb(): AnimeItem[] {
  if (cachedDb) return cachedDb;

  try {
    const dbPath = path.join(process.cwd(), 'src', 'data', 'anime-db.json');
    if (fs.existsSync(dbPath)) {
      const raw = fs.readFileSync(dbPath, 'utf8');
      cachedDb = JSON.parse(raw);
      return cachedDb || [];
    }
  } catch (e) {
    console.error('Failed to read anime database:', e);
  }

  return [];
}

export function getAnimeDb(): AnimeItem[] {
  return loadDb();
}

/**
 * Returns lightweight anime catalog items without thousands of nested episode objects.
 * Reduces page payload size by ~95% for instant page loads and ultra-fast tab switching.
 */
export function getAnimeCatalog(): AnimeItem[] {
  if (cachedCatalog) return cachedCatalog;

  // 1. Fast-path: Load pre-generated lightweight catalog (320 KB vs 9.4 MB)
  try {
    const catalogPath = path.join(process.cwd(), 'src', 'data', 'anime-catalog.json');
    if (fs.existsSync(catalogPath)) {
      const raw = fs.readFileSync(catalogPath, 'utf8');
      cachedCatalog = JSON.parse(raw);
      if (cachedCatalog && cachedCatalog.length > 0) {
        return cachedCatalog;
      }
    }
  } catch (e) {
    console.warn('Fallback to reading full anime DB for catalog:', e);
  }

  // 2. Fallback: Generate from full DB on the fly
  const db = loadDb();
  cachedCatalog = db.map((item) => ({
    title: item.title,
    slug: item.slug,
    saltSlug: item.saltSlug,
    url: item.url,
    type: item.type,
    poster: item.poster,
    backdrop: item.backdrop,
    description: item.description ? item.description.slice(0, 200) : '',
    genres: item.genres,
    audioLanguages: item.audioLanguages,
    episodeCount: item.episodes?.length || 0,
    anilist: item.anilist
      ? {
          id: item.anilist.id,
          romajiName: item.anilist.romajiName,
          englishName: item.anilist.englishName,
          nativeName: item.anilist.nativeName,
          description: '',
          coverImage: item.anilist.coverImage,
          bannerImage: item.anilist.bannerImage,
          rating: item.anilist.rating,
          year: item.anilist.year,
          season: item.anilist.season,
          status: item.anilist.status,
          genres: item.anilist.genres,
        }
      : null,
  }));

  return cachedCatalog;
}
