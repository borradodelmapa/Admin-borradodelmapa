/* ═══════════════════════════════════════════
   Service Worker — Admin Borrado del Mapa
   Caché offline + actualizaciones en background
   ═══════════════════════════════════════════ */

const CACHE_NAME = 'admin-cache-v3';
const STATIC_ASSETS = [
  '/',
  '/index.html',
  '/admin.css',
  '/config.js',
  '/logo-admin.svg',
  '/manifest.json',
  '/sw.js'
];
// admin.js NO se cachea — siempre network-first

// ─── INSTALL ───
self.addEventListener('install', event => {
  console.log('[SW] Instalando...');
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => {
        console.log('[SW] Cacheando archivos...');
        return cache.addAll(STATIC_ASSETS);
      })
      .then(() => self.skipWaiting())
  );
});

// ─── ACTIVATE ───
self.addEventListener('activate', event => {
  console.log('[SW] Activando...');
  event.waitUntil(
    caches.keys().then(cacheNames => {
      return Promise.all(
        cacheNames.map(name => {
          if (name !== CACHE_NAME) {
            console.log('[SW] Eliminando caché:', name);
            return caches.delete(name);
          }
        })
      );
    }).then(() => self.clients.claim())
  );
});

// ─── FETCH ───
self.addEventListener('fetch', event => {
  const { request } = event;
  const url = new URL(request.url);

  // Solo cachear peticiones GET
  if (request.method !== 'GET') {
    event.respondWith(fetch(request));
    return;
  }

  // admin.js: network-first (siempre actualizar)
  if (url.pathname === '/admin.js') {
    event.respondWith(
      fetch(request)
        .then(response => {
          if (response && response.status === 200) {
            return response;
          }
          return caches.match(request);
        })
        .catch(() => caches.match(request))
    );
    return;
  }

  // Archivos locales del mismo origen: cache-first
  if (url.origin === self.location.origin) {
    event.respondWith(
      caches.match(request)
        .then(response => response || fetch(request))
        .catch(() => caches.match('/index.html'))
    );
    return;
  }

  // APIs externas: network-first sin cachear
  event.respondWith(fetch(request).catch(() => {
    if (request.destination === 'document') {
      return caches.match('/index.html');
    }
  }));
});
