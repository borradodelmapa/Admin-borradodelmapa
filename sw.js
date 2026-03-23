/* ═══════════════════════════════════════════
   Service Worker — Admin Borrado del Mapa
   Caché offline + actualizaciones en background
   ═══════════════════════════════════════════ */

const CACHE_NAME = 'admin-cache-v1';
const STATIC_ASSETS = [
  '/admin/',
  '/admin/index.html',
  '/admin/admin.js',
  '/admin/admin.css',
  '/admin/config.js',
  '/admin/logo-admin.svg',
  '/admin/manifest.json',
  '/admin/sw.js'
];

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

  // Solo cachear peticiones GET de admin
  if (request.method !== 'GET') {
    event.respondWith(fetch(request));
    return;
  }

  // Archivos locales: cache-first
  if (url.pathname.startsWith('/admin/')) {
    event.respondWith(
      caches.match(request)
        .then(response => response || fetch(request))
        .catch(() => caches.match('/admin/index.html'))
    );
    return;
  }

  // APIs externas: network-first sin cachear
  event.respondWith(fetch(request).catch(() => {
    if (request.destination === 'document') {
      return caches.match('/admin/index.html');
    }
  }));
});
