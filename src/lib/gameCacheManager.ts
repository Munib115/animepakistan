'use client';

export const CACHE_NAME = 'anime-pakistan-cache-v3';
export const CACHE_DONE_KEY = 'ap_game_cache_v3_done';

export interface GameAsset {
  url: string;
  label: string;
  sizeKB: number;
}

export const GAME_ASSETS: GameAsset[] = [
  { url: '/offline', label: 'Offline Arcade Page', sizeKB: 40 },
  { url: '/emulatorjs/loader.js', label: 'Emulator Loader', sizeKB: 8 },
  { url: '/emulatorjs/emulator.min.css', label: 'Emulator Styles', sizeKB: 26 },
  { url: '/emulatorjs/emulator.min.js', label: 'Emulator Engine', sizeKB: 427 },
  { url: '/emulatorjs/compression/extractzip.js', label: 'ZIP Decompressor', sizeKB: 196 },
  { url: '/emulatorjs/src/compression.js', label: 'Compression Helper', sizeKB: 6 },
  { url: '/emulatorjs/cores/reports/mgba.json', label: 'GBA Core Config', sizeKB: 1 },
  { url: '/emulatorjs/cores/mgba-wasm.data', label: 'GBA WASM Engine', sizeKB: 1056 },
  { url: '/emulatorjs/cores/mgba-legacy-wasm.data', label: 'GBA Legacy Core', sizeKB: 1055 },
  { url: '/roms/dbz-supersonic-warriors.gba', label: 'Dragon Ball Z Game (16 MB)', sizeKB: 16384 },
];

/**
 * Check if the game files and ROM are fully cached in the browser's Cache Storage
 */
export async function isGameFullyCached(): Promise<boolean> {
  if (typeof window === 'undefined' || !('caches' in window)) return false;

  try {
    const cache = await caches.open(CACHE_NAME);
    const rom = await cache.match('/roms/dbz-supersonic-warriors.gba');
    const engine = await cache.match('/emulatorjs/emulator.min.js');
    const loader = await cache.match('/emulatorjs/loader.js');
    const isCached = Boolean(rom && engine && loader);
    if (isCached && typeof localStorage !== 'undefined') {
      localStorage.setItem(CACHE_DONE_KEY, '1');
    }
    return isCached;
  } catch {
    return false;
  }
}

let isDownloading = false;

/**
 * Download and cache all game assets into Cache Storage.
 * Can be called silently on first site visit, or on-demand with progress updates.
 */
export async function downloadGameAssets(
  onProgress?: (progress: number, currentAsset: string) => void
): Promise<boolean> {
  if (typeof window === 'undefined' || !('caches' in window)) return false;
  if (isDownloading) return true;

  isDownloading = true;
  const totalKB = GAME_ASSETS.reduce((sum, a) => sum + a.sizeKB, 0);
  let downloadedKB = 0;

  try {
    const cache = await caches.open(CACHE_NAME);

    for (const asset of GAME_ASSETS) {
      if (onProgress) {
        onProgress(Math.min(99, Math.round((downloadedKB / totalKB) * 100)), asset.label);
      }

      // Check if already in cache
      const existing = await cache.match(asset.url);
      if (existing) {
        downloadedKB += asset.sizeKB;
        continue;
      }

      try {
        const response = await fetch(asset.url, { cache: 'no-store' });
        if (response && response.status === 200) {
          await cache.put(asset.url, response.clone());
        }
      } catch (err) {
        console.warn(`[GameCache] Failed to download ${asset.url}:`, err);
      }

      downloadedKB += asset.sizeKB;
      const pct = Math.min(99, Math.round((downloadedKB / totalKB) * 100));
      if (onProgress) onProgress(pct, asset.label);
    }

    if (typeof localStorage !== 'undefined') {
      localStorage.setItem(CACHE_DONE_KEY, '1');
    }

    if (onProgress) {
      onProgress(100, 'All files ready for offline play!');
    }

    // Broadcast cache status across tabs and components
    window.dispatchEvent(
      new CustomEvent('ap-game-cache-updated', {
        detail: { status: 'ready', timestamp: Date.now() },
      })
    );

    isDownloading = false;
    return true;
  } catch (err) {
    console.error('[GameCache] Caching process failed:', err);
    isDownloading = false;
    return false;
  }
}

/**
 * Direct file download trigger for users who want the physical .gba file
 */
export function downloadRomFile() {
  if (typeof window === 'undefined') return;
  const link = document.createElement('a');
  link.href = '/roms/dbz-supersonic-warriors.gba';
  link.download = 'Dragon-Ball-Z-Supersonic-Warriors.gba';
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}
