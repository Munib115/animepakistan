const CACHE_NAME = 'anime-pakistan-cache-v4';

// Only tiny, critical assets are pre-cached at install time.
// Large game ROM and emulator files are cached lazily in background
// to avoid blocking the initial page load.
const CRITICAL_ASSETS = [
  '/',
  '/manifest.json',
  '/fonts/MaterialSymbolsOutlined.woff2',
];

// Complete Game assets cached in background after install (non-blocking)
const GAME_ASSETS = [
  '/offline',
  '/emulatorjs/loader.js',
  '/emulatorjs/emulator.min.js',
  '/emulatorjs/emulator.min.css',
  '/emulatorjs/compression/extractzip.js',
  '/emulatorjs/src/compression.js',
  '/emulatorjs/cores/reports/mgba.json',
  '/emulatorjs/cores/mgba-wasm.data',
  '/emulatorjs/cores/mgba-legacy-wasm.data',
  '/roms/dbz-supersonic-warriors.gba',
];

// Install Event: Only cache tiny critical assets — NO large files
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(CRITICAL_ASSETS).catch((err) => {
        console.warn('[SW] Critical pre-cache error:', err);
      });
    })
  );
  self.skipWaiting();
});

// Activate Event: Clear stale caches, then warm-up game assets in background
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => {
      return Promise.all(
        keys.map((key) => {
          if (key !== CACHE_NAME) {
            console.log('[SW] Removing old cache:', key);
            return caches.delete(key);
          }
        })
      );
    }).then(() => {
      // Lazily warm-up game assets in the background (non-blocking)
      caches.open(CACHE_NAME).then((cache) => {
        GAME_ASSETS.forEach((url) => {
          cache.match(url).then((hit) => {
            if (!hit) {
              fetch(url, { priority: 'low' }).then((res) => {
                if (res && res.status === 200) cache.put(url, res);
              }).catch(() => {});
            }
          });
        });
      });
    })
  );
  self.clients.claim();
});

// Fetch Event
self.addEventListener('fetch', (event) => {
  const requestUrl = new URL(event.request.url);

  // Avoid non-GET requests or hot reloads
  if (
    event.request.method !== 'GET' ||
    requestUrl.pathname.startsWith('/_next/webpack-hmr') ||
    requestUrl.pathname.includes('hot-update')
  ) {
    return;
  }

  // Strategy for Offline Emulator & Game ROMs & /offline page -> Cache-First
  if (
    requestUrl.pathname.startsWith('/emulatorjs/') ||
    requestUrl.pathname.startsWith('/roms/') ||
    requestUrl.pathname.startsWith('/api/game-rom') ||
    requestUrl.pathname === '/offline'
  ) {
    event.respondWith(
      caches.open(CACHE_NAME).then((cache) => {
        return cache.match(event.request).then((cachedResponse) => {
          if (cachedResponse) {
            return cachedResponse;
          }
          return fetch(event.request).then((networkResponse) => {
            if (networkResponse && networkResponse.status === 200) {
              cache.put(event.request, networkResponse.clone());
            }
            return networkResponse;
          });
        });
      })
    );
    return;
  }

  // Strategy for Images (TMDB, Anilist, local) -> Cache-First
  if (
    event.request.destination === 'image' ||
    event.request.url.includes('image.tmdb.org') ||
    event.request.url.includes('s4.anilist.co')
  ) {
    event.respondWith(
      caches.open(CACHE_NAME).then((cache) => {
        return cache.match(event.request).then((cachedResponse) => {
          if (cachedResponse) {
            return cachedResponse;
          }
          return fetch(event.request).then((networkResponse) => {
            if (networkResponse && networkResponse.status === 200) {
              cache.put(event.request, networkResponse.clone());
            }
            return networkResponse;
          }).catch(() => {
            return new Response('', { status: 404 });
          });
        });
      })
    );
    return;
  }

  // Strategy for Fonts -> Stale-While-Revalidate
  if (event.request.destination === 'font' || requestUrl.pathname.startsWith('/fonts/')) {
    event.respondWith(
      caches.open(CACHE_NAME).then((cache) => {
        return cache.match(event.request).then((cachedResponse) => {
          const fetchPromise = fetch(event.request).then((networkResponse) => {
            if (networkResponse && networkResponse.status === 200) {
              cache.put(event.request, networkResponse.clone());
            }
            return networkResponse;
          });
          return cachedResponse || fetchPromise;
        });
      })
    );
    return;
  }

  // Strategy for HTML/Pages -> Network-First (Fallback to cached page or /offline DBZ Arcade)
  if (
    event.request.mode === 'navigate' ||
    event.request.headers.get('accept')?.includes('text/html')
  ) {
    event.respondWith(
      fetch(event.request)
        .then((networkResponse) => {
          if (networkResponse.status === 200) {
            const responseClone = networkResponse.clone();
            caches.open(CACHE_NAME).then((cache) => {
              cache.put(event.request, responseClone);
            });
          }
          return networkResponse;
        })
        .catch(() => {
          // If network is completely offline, return cached version or route to /offline DBZ game
          return caches.match(event.request).then((cachedResponse) => {
            if (cachedResponse) {
              return cachedResponse;
            }
            return caches.match('/offline').then((offlineGamePage) => {
              if (offlineGamePage) {
                return offlineGamePage;
              }
              // Fallback redirect to /offline
              return Response.redirect('/offline', 302);
            });
          });
        })
    );
    return;
  }
});
