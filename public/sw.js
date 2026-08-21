const CACHE_NAME = 'anime-urdu-cache-v1';
const ASSETS_TO_CACHE = [
  '/',
  '/manifest.json',
  '/fonts/MaterialSymbolsOutlined.woff2'
];

// Install Event
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      console.log('[Service Worker] Pre-caching static assets');
      return cache.addAll(ASSETS_TO_CACHE);
    })
  );
  self.skipWaiting();
});

// Activate Event
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

  // Avoid caching non-GET requests, chrome extensions, dev hot reloads, or external tracking
  if (
    event.request.method !== 'GET' ||
    !event.request.url.startsWith(self.location.origin) && 
    !event.request.url.includes('image.tmdb.org') &&
    !event.request.url.includes('s4.anilist.co')
  ) {
    return;
  }

  // Next.js hot reload / webpack requests
  if (requestUrl.pathname.startsWith('/_next/webpack-hmr') || requestUrl.pathname.includes('hot-update')) {
    return;
  }

  // Strategy for Images (TMDB CDN, Anilist CDN, local images) -> Cache-First
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
            cache.put(event.request, networkResponse.clone());
            return networkResponse;
          }).catch(() => {
            // Offline fallback for images (could be a local generic image)
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
            cache.put(event.request, networkResponse.clone());
            return networkResponse;
          });
          return cachedResponse || fetchPromise;
        });
      })
    );
    return;
  }

  // Strategy for HTML/Pages -> Network-First (fallback to cache)
  event.respondWith(
    fetch(event.request)
      .then((networkResponse) => {
        // If it's a valid HTML page, cache it
        if (networkResponse.status === 200 && networkResponse.headers.get('content-type')?.includes('text/html')) {
          const responseClone = networkResponse.clone();
          caches.open(CACHE_NAME).then((cache) => {
            cache.put(event.request, responseClone);
          });
        }
        return networkResponse;
      })
      .catch(() => {
        // If network fails, try cache
        return caches.match(event.request).then((cachedResponse) => {
          if (cachedResponse) {
            return cachedResponse;
          }
          // offline text response
          return new Response(
            '<html><head><meta name="viewport" content="width=device-width, initial-scale=1.0"><title>Offline - ANIME URDU</title><style>body{background-color:#0a0f0d;color:#fff;font-family:sans-serif;display:flex;flex-direction:column;align-items:center;justify-content:center;height:100vh;margin:0;padding:20px;text-align:center;}h1{color:#10b981;}p{color:#9ca3af;}</style></head><body><h1>You are Offline</h1><p>Check your internet connection and try again.</p></body></html>',
            {
              headers: { 'Content-Type': 'text/html' }
            }
          );
        });
      })
  );
});
