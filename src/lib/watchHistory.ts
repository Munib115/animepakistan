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
      ? items.sort((a, b) => (b.updatedAt || 0) - (a.updatedAt || 0))
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
    // Keep up to 100 history entries so user history is never lost prematurely
    const updated = [newItem, ...filtered].slice(0, 100);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
    window.dispatchEvent(new Event('ap_history_updated'));
  } catch (e) {}
}

export function removeWatchItem(animeSlug: string) {
  if (typeof window === 'undefined') return;
  try {
    const history = getWatchHistory();
    const updated = history.filter((h) => h.animeSlug !== animeSlug);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
    window.dispatchEvent(new Event('ap_history_updated'));
  } catch (e) {}
}

export function clearWatchHistory() {
  if (typeof window === 'undefined') return;
  try {
    localStorage.removeItem(STORAGE_KEY);
    window.dispatchEvent(new Event('ap_history_updated'));
  } catch (e) {}
}

export function getAnimeWatchProgress(animeSlug: string): WatchProgressItem | null {
  const history = getWatchHistory();
  return history.find((h) => h.animeSlug === animeSlug) || null;
}

export function formatTimeSeconds(seconds: number): string {
  if (!seconds || isNaN(seconds) || seconds < 0) return '0:00';
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  const hrs = Math.floor(mins / 60);
  if (hrs > 0) {
    const remMins = mins % 60;
    return `${hrs}:${remMins < 10 ? '0' : ''}${remMins}:${secs < 10 ? '0' : ''}${secs}`;
  }
  return `${mins}:${secs < 10 ? '0' : ''}${secs}`;
}

export function formatRelativeTime(timestamp: number, isUrdu = false): string {
  if (!timestamp) return '';
  const now = Date.now();
  const diffSec = Math.floor((now - timestamp) / 1000);
  if (diffSec < 60) return isUrdu ? 'ابھی' : 'Just now';
  const diffMin = Math.floor(diffSec / 60);
  if (diffMin < 60) return isUrdu ? `${diffMin} منٹ پہلے` : `${diffMin}m ago`;
  const diffHours = Math.floor(diffMin / 60);
  if (diffHours < 24) return isUrdu ? `${diffHours} گھنٹے پہلے` : `${diffHours}h ago`;
  const diffDays = Math.floor(diffHours / 24);
  if (diffDays === 1) return isUrdu ? 'کل' : 'Yesterday';
  if (diffDays < 30) return isUrdu ? `${diffDays} دن پہلے` : `${diffDays}d ago`;
  return new Date(timestamp).toLocaleDateString();
}
