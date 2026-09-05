import { AnimeItem } from '@/types/anime';
import animeCatalogData from '@/data/anime-catalog.json';

let cachedDb: AnimeItem[] | null = null;
const cachedCatalog: AnimeItem[] = animeCatalogData as AnimeItem[];

export function getAnimeDb(): AnimeItem[] {
  if (!cachedDb) {
    // Lazily load full 9.4MB episode database only when detail or watch routes request it
    cachedDb = require('@/data/anime-db.json') as AnimeItem[];
  }
  return cachedDb;
}

/**
 * Returns lightweight anime catalog items without thousands of nested episode objects.
 * Reduces page payload size by ~95% for instant page loads and ultra-fast tab switching.
 */
export function getAnimeCatalog(): AnimeItem[] {
  return cachedCatalog;
}

