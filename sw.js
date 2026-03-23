// Schedy PWA Service Worker
// Offline-first with cache-then-network for assets

const CACHE_NAME = 'schedy-v1.0.0';
const STATIC_CACHE = 'schedy-static-v1.0.0';
const FONT_CACHE = 'schedy-fonts-v1.0.0';

// Core app shell — always cache these
const APP_SHELL = [
  './index.html',
  './manifest.json',
  './icons/icon-192.png',
  './icons/icon-512.png'
];

// External fonts/icons to cache
const FONT_URLS = [
  'https://fonts.googleapis.com/css2?family=Google+Sans:wght@400;500;700&family=Google+Sans+Display:wght@400;500;700&family=Roboto:wght@300;400;500&family=Material+Icons+Round',
  'https://fonts.googleapis.com/icon?family=Material+Icons+Round'
];

// ── INSTALL: Pre-cache app shell ──
self.addEventListener('install', event => {
  console.log('[SW] Installing Schedy service worker...');
  event.waitUntil(
    caches.open(STATIC_CACHE).then(cache => {
      console.log('[SW] Caching app shell');
      return cache.addAll(APP_SHELL);
    }).then(() => self.skipWaiting())
  );
});

// ── ACTIVATE: Clean up old caches ──
self.addEventListener('activate', event => {
  console.log('[SW] Activating Schedy service worker...');
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(
        keys
          .filter(key => key !== STATIC_CACHE && key !== FONT_CACHE && key !== CACHE_NAME)
          .map(key => {
            console.log('[SW] Deleting old cache:', key);
            return caches.delete(key);
          })
      )
    ).then(() => self.clients.claim())
  );
});

// ── FETCH: Offline-first strategy ──
self.addEventListener('fetch', event => {
  const { request } = event;
  const url = new URL(request.url);

  // Skip non-GET requests
  if (request.method !== 'GET') return;

  // Skip chrome-extension and non-http requests
  if (!request.url.startsWith('http')) return;

  // Fonts — cache-first (fonts rarely change)
  if (
    url.hostname === 'fonts.googleapis.com' ||
    url.hostname === 'fonts.gstatic.com'
  ) {
    event.respondWith(cacheFirst(request, FONT_CACHE));
    return;
  }

  // App shell & local assets — cache-first
  if (url.origin === self.location.origin) {
    event.respondWith(cacheFirst(request, STATIC_CACHE));
    return;
  }

  // Everything else — network-first with cache fallback
  event.respondWith(networkFirst(request, CACHE_NAME));
});

// ── STRATEGY: Cache First ──
async function cacheFirst(request, cacheName) {
  const cached = await caches.match(request);
  if (cached) return cached;

  try {
    const response = await fetch(request);
    if (response.ok) {
      const cache = await caches.open(cacheName);
      cache.put(request, response.clone());
    }
    return response;
  } catch (err) {
    // Return offline fallback if available
    const fallback = await caches.match('./index.html');
    return fallback || new Response('Offline', { status: 503 });
  }
}

// ── STRATEGY: Network First ──
async function networkFirst(request, cacheName) {
  try {
    const response = await fetch(request);
    if (response.ok) {
      const cache = await caches.open(cacheName);
      cache.put(request, response.clone());
    }
    return response;
  } catch (err) {
    const cached = await caches.match(request);
    return cached || new Response('Offline', { status: 503 });
  }
}

// ── BACKGROUND SYNC: Save pending data ──
self.addEventListener('sync', event => {
  if (event.tag === 'sync-schedule') {
    console.log('[SW] Background sync triggered');
  }
});

// ── PUSH NOTIFICATIONS (placeholder for future) ──
self.addEventListener('push', event => {
  if (!event.data) return;
  const data = event.data.json();
  self.registration.showNotification(data.title || 'Schedy', {
    body: data.body || 'Schedule update',
    icon: './icons/icon-192.png',
    badge: './icons/icon-72.png',
    tag: 'schedy-notification'
  });
});
