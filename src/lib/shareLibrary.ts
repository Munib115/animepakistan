import { supabase } from './supabase';
import { getWatchlist, WatchlistItem } from './watchlist';
import { getWatchHistory, WatchProgressItem } from './watchHistory';
import { getGuestProfile } from './guestIdentity';

export interface SharedLibraryRecord {
  id?: string;
  share_code: string;
  creator_id: string;
  creator_name: string;
  watchlist: WatchlistItem[];
  history: WatchProgressItem[];
  created_at?: string;
  expires_at?: string;
}

const CHARS = '23456789ABCDEFGHJKLMNPQRSTUVWXYZ';
const LOCAL_MY_CODE_KEY = 'ap_my_share_code';

/** Generate clean, memorable 6-character code like AP-7K9M */
export function generateRandomCode(): string {
  let part = '';
  for (let i = 0; i < 4; i++) {
    part += CHARS.charAt(Math.floor(Math.random() * CHARS.length));
  }
  return `AP-${part}`;
}

/** Normalize entered code: uppercase, trim, and accept with or without AP- prefix */
export function normalizeShareCode(input: string): string {
  let clean = input.trim().toUpperCase().replace(/\s+/g, '');
  if (!clean.startsWith('AP-')) {
    if (clean.startsWith('AP')) {
      clean = 'AP-' + clean.slice(2);
    } else {
      clean = 'AP-' + clean;
    }
  }
  return clean;
}

/** Get previously generated code on this device if any */
export function getSavedMyShareCode(): string | null {
  if (typeof window === 'undefined') return null;
  try {
    return localStorage.getItem(LOCAL_MY_CODE_KEY);
  } catch (e) {
    return null;
  }
}

/**
 * Publish current device's Watchlist and Watch Progress to Supabase.
 * Returns the share code.
 */
export async function publishMyLibrary(forceNewCode = false): Promise<{
  success: boolean;
  shareCode?: string;
  watchlistCount: number;
  historyCount: number;
  error?: string;
}> {
  const watchlist = getWatchlist();
  const history = getWatchHistory();
  const profile = getGuestProfile();

  let code = forceNewCode ? null : getSavedMyShareCode();
  if (!code) {
    code = generateRandomCode();
  }

  if (!supabase) {
    return {
      success: false,
      watchlistCount: watchlist.length,
      historyCount: history.length,
      error: 'Supabase client is not initialized.',
    };
  }

  try {
    const payload = {
      share_code: code,
      creator_id: profile.id,
      creator_name: profile.name,
      watchlist: watchlist || [],
      history: history || [],
      created_at: new Date().toISOString(),
      expires_at: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
    };

    const { error } = await supabase
      .from('shared_libraries')
      .upsert(payload, { onConflict: 'share_code' });

    if (error) {
      // If code conflict with another user's code, try one more time with a fresh code
      const freshCode = generateRandomCode();
      payload.share_code = freshCode;
      const retry = await supabase.from('shared_libraries').insert([payload]);
      if (retry.error) {
        throw new Error(retry.error.message);
      }
      code = freshCode;
    }

    if (typeof window !== 'undefined') {
      try {
        localStorage.setItem(LOCAL_MY_CODE_KEY, code);
      } catch (e) {}
    }

    return {
      success: true,
      shareCode: code,
      watchlistCount: watchlist.length,
      historyCount: history.length,
    };
  } catch (err: any) {
    console.error('Failed to publish shared library:', err);
    return {
      success: false,
      watchlistCount: watchlist.length,
      historyCount: history.length,
      error: err.message || 'Could not publish library to cloud.',
    };
  }
}

/**
 * Look up a shared library in Supabase by 6-character code.
 */
export async function fetchLibraryByCode(rawCode: string): Promise<{
  success: boolean;
  data?: SharedLibraryRecord;
  error?: string;
}> {
  if (!rawCode || !rawCode.trim()) {
    return { success: false, error: 'Please enter a share code.' };
  }

  if (!supabase) {
    return { success: false, error: 'Supabase client is not available.' };
  }

  const code = normalizeShareCode(rawCode);

  try {
    const { data, error } = await supabase
      .from('shared_libraries')
      .select('*')
      .eq('share_code', code)
      .maybeSingle();

    if (error) {
      return { success: false, error: error.message };
    }

    if (!data) {
      return {
        success: false,
        error: `No library found for code "${code}". Please check the code and try again.`,
      };
    }

    // Check expiration
    if (data.expires_at && new Date(data.expires_at).getTime() < Date.now()) {
      return {
        success: false,
        error: `This share code (${code}) has expired. Ask your friend to re-sync their library.`,
      };
    }

    return {
      success: true,
      data: {
        id: data.id,
        share_code: data.share_code,
        creator_id: data.creator_id,
        creator_name: data.creator_name || 'Anime Friend',
        watchlist: Array.isArray(data.watchlist) ? data.watchlist : [],
        history: Array.isArray(data.history) ? data.history : [],
        created_at: data.created_at,
        expires_at: data.expires_at,
      },
    };
  } catch (err: any) {
    return { success: false, error: err.message || 'Error fetching library from cloud.' };
  }
}

/**
 * Apply a shared library to the local device:
 * - 'merge': combines items without losing current watchlist or progress
 * - 'replace': overwrites local library with the shared one
 */
export function applySharedLibrary(
  shared: SharedLibraryRecord,
  mode: 'merge' | 'replace'
): { addedWatchlist: number; addedHistory: number } {
  if (typeof window === 'undefined') return { addedWatchlist: 0, addedHistory: 0 };

  const currentWatchlist = getWatchlist();
  const currentHistory = getWatchHistory();

  let finalWatchlist: WatchlistItem[] = [];
  let finalHistory: WatchProgressItem[] = [];

  let addedWatchlist = 0;
  let addedHistory = 0;

  if (mode === 'replace') {
    finalWatchlist = [...(shared.watchlist || [])];
    finalHistory = [...(shared.history || [])];
    addedWatchlist = finalWatchlist.length;
    addedHistory = finalHistory.length;
  } else {
    // Merge Watchlist
    const existingSlugs = new Set(currentWatchlist.map((w) => w.slug));
    const newWatchlistItems: WatchlistItem[] = [];
    for (const item of shared.watchlist || []) {
      if (!existingSlugs.has(item.slug)) {
        newWatchlistItems.push(item);
        existingSlugs.add(item.slug);
        addedWatchlist++;
      }
    }
    finalWatchlist = [...newWatchlistItems, ...currentWatchlist];

    // Merge History
    const historyMap = new Map<string, WatchProgressItem>();
    for (const h of currentHistory) {
      historyMap.set(h.animeSlug, h);
    }
    for (const h of shared.history || []) {
      const existing = historyMap.get(h.animeSlug);
      if (!existing) {
        historyMap.set(h.animeSlug, h);
        addedHistory++;
      } else if ((h.updatedAt || 0) > (existing.updatedAt || 0)) {
        // Shared item is newer
        historyMap.set(h.animeSlug, h);
      }
    }
    finalHistory = Array.from(historyMap.values()).sort(
      (a, b) => (b.updatedAt || 0) - (a.updatedAt || 0)
    );
  }

  try {
    localStorage.setItem('ap_my_watchlist', JSON.stringify(finalWatchlist));
    localStorage.setItem('ap_continue_watching', JSON.stringify(finalHistory));

    // Dispatch global events so UI updates reactively everywhere
    window.dispatchEvent(new Event('ap_history_updated'));
    window.dispatchEvent(new Event('storage'));
  } catch (e) {
    console.error('Failed to save imported library:', e);
  }

  return { addedWatchlist, addedHistory };
}
