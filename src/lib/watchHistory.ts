export interface WatchProgressItem {
  animeSlug: string;
  animeTitle: string;
  poster: string;
  backdrop?: string;
  type: 'movie' | 'series';
  epSlug?: string;
  epTitle?: string;
  epNumber?: number;
  currentTime: number; // in seconds
  duration: number; // in seconds
  progressPercent: number; // 0 to 100
  updatedAt: number; // timestamp
}

const STORAGE_KEY = 'ap_continue_watching';

export function getWatchHistory(): WatchProgressItem[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const items: WatchProgressItem[] = JSON.parse(raw);
    return Array.isArray(items)
      ? items.sort((a, b) => b.updatedAt - a.updatedAt)
      : [];
  } catch (e) {
    return [];
  }
}

export function saveWatchProgress(item: Omit<WatchProgressItem, 'updatedAt'>) {
  if (typeof window === 'undefined') return;
  try {
    const history = getWatchHistory();
    const percent = item.duration > 0
      ? Math.min(100, Math.max(1, Math.round((item.currentTime / item.duration) * 100)))
      : item.progressPercent || 10;

    const newItem: WatchProgressItem = {
      ...item,
      progressPercent: percent,
      updatedAt: Date.now(),
    };

    // Filter out previous entry for same anime
    const filtered = history.filter((h) => h.animeSlug !== item.animeSlug);
    // Keep top 20 items
    const updated = [newItem, ...filtered].slice(0, 20);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
  } catch (e) {}
}

export function removeWatchItem(animeSlug: string) {
  if (typeof window === 'undefined') return;
  try {
    const history = getWatchHistory();
    const updated = history.filter((h) => h.animeSlug !== animeSlug);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
  } catch (e) {}
}

export function getAnimeWatchProgress(animeSlug: string): WatchProgressItem | null {
  const history = getWatchHistory();
  return history.find((h) => h.animeSlug === animeSlug) || null;
}
