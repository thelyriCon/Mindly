// Mindly Service Worker — Background Sync & Offline Course Asset Cache Engine
// Coordinates offline availability, background sync triggers, and media caching.

const SHELL_CACHE = 'mindly-shell-v2.5';
const COURSE_ASSET_CACHE = 'mindly-course-assets-v1';
const API_OFFLINE_CACHE = 'mindly-offline-api-v1';

const PRECACHE_ASSETS = [
  '/',
  '/index.html',
  '/manifest.webmanifest',
  '/manifest.json',
  '/icon.svg',
  '/logo.png',
  '/favicon.ico',
  '/apple-touch-icon.png',
];

// 1. Install: Precache application shell assets
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(SHELL_CACHE).then((cache) => {
      return cache.addAll(PRECACHE_ASSETS).catch((err) => {
        console.warn('[SW] Shell precache notice:', err);
      });
    })
  );
  self.skipWaiting();
});

// 2. Activate: Clear stale version caches while preserving course assets & offline API cache
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => {
      return Promise.all(
        keys.map((key) => {
          if (
            key !== SHELL_CACHE &&
            key !== COURSE_ASSET_CACHE &&
            key !== API_OFFLINE_CACHE
          ) {
            console.log('[SW] Purging outdated cache:', key);
            return caches.delete(key);
          }
        })
      );
    }).then(() => self.clients.claim())
  );
});

// 3. Background Sync: Detect when connectivity is restored and notify client outbox
self.addEventListener('sync', (event) => {
  if (event.tag === 'mindly-sync-pending' || event.tag === 'mindly-sync') {
    event.waitUntil(
      self.clients.matchAll({ includeUncontrolled: true, type: 'window' }).then((clients) => {
        clients.forEach((client) => {
          client.postMessage({ type: 'MINDLY_TRIGGER_BACKGROUND_SYNC' });
        });
      })
    );
  }
});

// 4. Fetch Strategy Routing
self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);

  // A. Bypass internal dev tooling
  if (
    url.pathname.startsWith('/@') ||
    url.pathname.includes('node_modules') ||
    url.pathname.includes('hot-update')
  ) {
    return;
  }

  // B. Educational & Course Images (Wikimedia, Unsplash, or media endpoints)
  // Strategy: Cache-First with Stale-While-Revalidate
  const isImageRequest =
    event.request.destination === 'image' ||
    url.hostname.includes('wikimedia.org') ||
    url.hostname.includes('unsplash.com') ||
    url.pathname.startsWith('/api/media/') ||
    /\.(png|jpe?g|svg|webp|gif|avif)(\?.*)?$/i.test(url.pathname);

  if (event.request.method === 'GET' && isImageRequest) {
    event.respondWith(
      caches.open(COURSE_ASSET_CACHE).then(async (cache) => {
        const cached = await cache.match(event.request);
        if (cached) {
          // Revalidate in background asynchronously without blocking
          fetch(event.request.clone())
            .then((networkRes) => {
              if (networkRes && (networkRes.status === 200 || networkRes.type === 'opaque')) {
                try {
                  cache.put(event.request, networkRes.clone());
                } catch {}
              }
            })
            .catch(() => {});
          return cached;
        }

        try {
          const networkRes = await fetch(event.request);
          if (networkRes && (networkRes.status === 200 || networkRes.type === 'opaque')) {
            try {
              await cache.put(event.request, networkRes.clone());
            } catch {}
          }
          return networkRes;
        } catch (fetchErr) {
          return cached || new Response('', { status: 404, statusText: 'Image unavailable' });
        }
      })
    );
    return;
  }

  // C. Read-Only Course, Lesson, Notes, & Terms APIs
  // Strategy: Network-First with Offline API Cache Fallback
  const isCacheableApi =
    event.request.method === 'GET' &&
    (url.pathname.startsWith('/api/courses') ||
      url.pathname.startsWith('/api/lessons') ||
      url.pathname.startsWith('/api/notes') ||
      url.pathname.startsWith('/api/terms') ||
      url.pathname.startsWith('/api/study-progress') ||
      url.pathname === '/api/auth/me');

  if (isCacheableApi) {
    event.respondWith(
      fetch(event.request)
        .then((networkRes) => {
          if (networkRes && networkRes.status === 200) {
            const clone = networkRes.clone();
            caches.open(API_OFFLINE_CACHE).then((cache) => {
              cache.put(event.request, clone);
            });
          }
          return networkRes;
        })
        .catch(async () => {
          // Device is offline or server unreachable: match from API offline cache
          const cached = await caches.match(event.request);
          if (cached) {
            console.log('[SW] Serving offline cached API response for:', url.pathname);
            return cached;
          }
          return new Response(
            JSON.stringify({ offline: true, error: 'Offline - resource not yet cached' }),
            {
              status: 503,
              headers: { 'Content-Type': 'application/json' },
            }
          );
        })
    );
    return;
  }

  // Bypass other non-GET API requests to be handled by app/syncEngine
  if (event.request.method !== 'GET' || url.pathname.startsWith('/api/')) {
    return;
  }

  // D. Document Navigation (HTML pages): Network-First with offline fallback
  if (event.request.mode === 'navigate') {
    event.respondWith(
      fetch(event.request)
        .then((networkResponse) => {
          if (networkResponse && networkResponse.status === 200) {
            const copy = networkResponse.clone();
            caches.open(SHELL_CACHE).then((cache) => {
              cache.put(event.request, copy);
            });
          }
          return networkResponse;
        })
        .catch(async () => {
          const cached = await caches.match(event.request);
          if (cached) return cached;
          const fallback = (await caches.match('/index.html')) || (await caches.match('/'));
          if (fallback) return fallback;
          return new Response('Mindly is currently offline. Please reconnect.', {
            status: 503,
            headers: { 'Content-Type': 'text/plain' },
          });
        })
    );
    return;
  }

  // E. Immutable Hashed Bundles (/assets/*): Cache-First
  if (url.pathname.startsWith('/assets/')) {
    event.respondWith(
      caches.match(event.request).then((cached) => {
        if (cached) return cached;
        return fetch(event.request).then((networkResponse) => {
          if (networkResponse && networkResponse.status === 200) {
            const copy = networkResponse.clone();
            caches.open(SHELL_CACHE).then((cache) => {
              cache.put(event.request, copy);
            });
          }
          return networkResponse;
        });
      })
    );
    return;
  }

  // F. Static Shell Assets (manifest, icons): Stale-While-Revalidate
  event.respondWith(
    caches.match(event.request).then((cached) => {
      const fetchPromise = fetch(event.request)
        .then((networkResponse) => {
          if (networkResponse && networkResponse.status === 200 && networkResponse.type === 'basic') {
            const copy = networkResponse.clone();
            caches.open(SHELL_CACHE).then((cache) => {
              cache.put(event.request, copy);
            });
          }
          return networkResponse;
        })
        .catch(() => cached);

      return cached || fetchPromise;
    })
  );
});

// 5. Message Event: Course Asset Precaching & Cache Controls
self.addEventListener('message', (event) => {
  if (!event.data) return;

  if (event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  } else if (event.data.type === 'CACHE_COURSE_ASSETS' && Array.isArray(event.data.urls)) {
    const urls = event.data.urls;
    event.waitUntil(
      caches.open(COURSE_ASSET_CACHE).then((cache) => {
        return Promise.allSettled(
          urls.map((u) =>
            fetch(u, { mode: 'cors' })
              .then((res) => {
                if (res.ok) cache.put(u, res);
              })
              .catch(() => {})
          )
        );
      })
    );
  } else if (event.data.type === 'PURGE_CACHE') {
    event.waitUntil(
      caches.keys().then((keys) => {
        return Promise.all(keys.map((k) => caches.delete(k)));
      })
    );
  }
});
