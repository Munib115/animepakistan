import fs from 'fs';
import path from 'path';
import { AnimeItem } from '@/types/anime';

let cachedDb: AnimeItem[] | null = null;
let lastMtime = 0;

export function getAnimeDb(): AnimeItem[] {
  try {
    const dbPath = path.join(process.cwd(), 'src', 'data', 'anime-db.json');
    if (fs.existsSync(dbPath)) {
      const stats = fs.statSync(dbPath);
      if (!cachedDb || stats.mtimeMs !== lastMtime) {
        const raw = fs.readFileSync(dbPath, 'utf8');
        cachedDb = JSON.parse(raw);
        lastMtime = stats.mtimeMs;
      }
      return cachedDb || [];
    }
  } catch (e) {
    console.error('Failed to read anime database:', e);
  }

  return cachedDb || [];
}
