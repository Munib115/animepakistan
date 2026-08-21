import fs from 'fs';
import path from 'path';
import { AnimeItem } from '@/types/anime';

let cachedDb: AnimeItem[] | null = null;

export function getAnimeDb(): AnimeItem[] {
  if (cachedDb) {
    return cachedDb;
  }

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

  return cachedDb || [];
}
