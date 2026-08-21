export interface WatchlistItem {
  slug: string;
  title: string;
  poster: string;
  type: 'movie' | 'series';
  addedAt: number;
}

const STORAGE_KEY = 'ap_my_watchlist';

export function getWatchlist(): WatchlistItem[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const items: WatchlistItem[] = JSON.parse(raw);
    return Array.isArray(items) ? items.sort((a, b) => b.addedAt - a.addedAt) : [];
  } catch (e) {
    return [];
  }
}

export function toggleWatchlist(item: Omit<WatchlistItem, 'addedAt'>): boolean {
  if (typeof window === 'undefined') return false;
  try {
    const list = getWatchlist();
    const exists = list.some((w) => w.slug === item.slug);
    let updated: WatchlistItem[];

    if (exists) {
      updated = list.filter((w) => w.slug !== item.slug);
      localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
      return false; // removed
    } else {
      const newItem: WatchlistItem = { ...item, addedAt: Date.now() };
      updated = [newItem, ...list];
      localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
      return true; // added
    }
  } catch (e) {
    return false;
  }
}

export function isInWatchlist(slug: string): boolean {
  const list = getWatchlist();
  return list.some((w) => w.slug === slug);
}
