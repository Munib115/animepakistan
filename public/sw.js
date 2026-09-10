const CACHE_NAME = 'anime-pakistan-cache-v2';
const ASSETS_TO_CACHE = [
  '/',
  '/offline',
  '/manifest.json',
  '/logo.png?v=ap5',
  '/fonts/MaterialSymbolsOutlined.woff2',
  '/roms/dbz-supersonic-warriors.zip',
  '/emulatorjs/loader.js',
  '/emulatorjs/emulator.min.js',
  '/emulatorjs/emulator.min.css',
  '/emulatorjs/cores/reports/mgba.json',
  '/emulatorjs/cores/mgba-wasm.data',
  '/emulatorjs/cores/mgba-legacy-wasm.data'
];

// Install Event: Pre-cache core assets including offline DBZ arcade
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      console.log('[Service Worker] Pre-caching static assets and offline arcade');
      return cache.addAll(ASSETS_TO_CACHE).catch((err) => {
        console.warn('[Service Worker] Pre-caching notice:', err);
      });
    })
  );
  self.skipWaiting();
});

// Activate Event: Clear stale caches
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => {
      return Promise.all(
        keys.map((key) => {
          if (key !== CACHE_NAME) {
            console.log('[Service Worker] Removing old cache:', key);
            return caches.delete(key);
          }
        })
      );
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

  // Strategy for Offline Emulator & Game ROMs -> Cache-First
  if (
    requestUrl.pathname.startsWith('/emulatorjs/') ||
    requestUrl.pathname.startsWith('/roms/') ||
    requestUrl.pathname.startsWith('/api/game-rom')
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
