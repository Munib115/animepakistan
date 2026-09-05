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

export function toggleWatchlist(item: Omit<WatchlistItem, 'addedAt'> | string): boolean {
  if (typeof window === 'undefined') return false;
  try {
    const slug = typeof item === 'string' ? item : item.slug;
    const list = getWatchlist();
    const exists = list.some((w) => w.slug === slug);
    let updated: WatchlistItem[];

    if (exists) {
      updated = list.filter((w) => w.slug !== slug);
      localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
      window.dispatchEvent(new CustomEvent('ap_watchlist_updated', { detail: { slug, added: false } }));
      return false; // removed
    } else {
      const newItem: WatchlistItem = typeof item === 'string' 
        ? { slug, title: slug, poster: '', type: 'series', addedAt: Date.now() }
        : { 
            slug: item.slug, 
            title: item.title || item.slug, 
            poster: item.poster || '', 
            type: item.type || 'series', 
            addedAt: Date.now() 
          };
      updated = [newItem, ...list];
      localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
      window.dispatchEvent(new CustomEvent('ap_watchlist_updated', { detail: { slug, added: true } }));
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
