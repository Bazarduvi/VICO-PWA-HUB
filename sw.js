// ===== PWA MANAGER PRO — SERVICE WORKER =====
// Versión: 1.0.1
// Estrategia: Cache First con fallback a red

const CACHE_NAME = 'pwa-manager-pro-v1';
const CACHE_VERSION = 1;

// Archivos esenciales que se cachean en la instalación
const ASSETS_TO_CACHE = [
  '/VICO-PWA-HUB/',
  '/VICO-PWA-HUB/index.html',
  '/VICO-PWA-HUB/manifest.json',
  '/VICO-PWA-HUB/assets/icons/icon-192.png',
  '/VICO-PWA-HUB/assets/icons/icon-512.png'
];

// ===== INSTALL =====
self.addEventListener('install', event => {
  console.log('[SW] Instalando versión:', CACHE_NAME);
  
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => {
        console.log('[SW] Cacheando archivos esenciales...');
        return cache.addAll(ASSETS_TO_CACHE);
      })
      .then(() => {
        console.log('[SW] Instalación completada');
        return self.skipWaiting();
      })
      .catch(err => {
        console.error('[SW] Error durante la instalación:', err);
      })
  );
});

// ===== ACTIVATE =====
self.addEventListener('activate', event => {
  console.log('[SW] Activando versión:', CACHE_NAME);
  
  event.waitUntil(
    caches.keys()
      .then(cacheNames => {
        return Promise.all(
          cacheNames
            .filter(name => name !== CACHE_NAME)
            .map(name => {
              console.log('[SW] Eliminando cache antiguo:', name);
              return caches.delete(name);
            })
        );
      })
      .then(() => {
        console.log('[SW] Activación completada. Tomando control de clientes.');
        return self.clients.claim();
      })
  );
});

// ===== FETCH =====
self.addEventListener('fetch', event => {
  if (event.request.method !== 'GET') return;

  const url = new URL(event.request.url);
  if (url.origin !== self.location.origin) return;

  event.respondWith(
    caches.match(event.request)
      .then(cachedResponse => {
        if (cachedResponse) {
          const fetchPromise = fetch(event.request)
            .then(networkResponse => {
              if (networkResponse && networkResponse.status === 200) {
                const responseClone = networkResponse.clone();
                caches.open(CACHE_NAME).then(cache => {
                  cache.put(event.request, responseClone);
                });
              }
              return networkResponse;
            })
            .catch(() => {});
          
          return cachedResponse;
        }

        return fetch(event.request)
          .then(networkResponse => {
            if (!networkResponse || networkResponse.status !== 200 || networkResponse.type === 'error') {
              return networkResponse;
            }

            const responseClone = networkResponse.clone();
            caches.open(CACHE_NAME).then(cache => {
              cache.put(event.request, responseClone);
            });

            return networkResponse;
          })
          .catch(() => {
            if (event.request.destination === 'document') {
              return caches.match('/VICO-PWA-HUB/index.html');
            }
          });
      })
  );
});

// ===== PUSH NOTIFICATIONS =====
self.addEventListener('push', event => {
  const data = event.data ? event.data.json() : {};
  const title = data.title || 'PWA Manager Pro';
  const options = {
    body: data.body || 'Nueva notificación',
    icon: '/VICO-PWA-HUB/assets/icons/icon-192.png',
    badge: '/VICO-PWA-HUB/assets/icons/icon-192.png',
    vibrate: [100, 50, 100],
    data: { url: data.url || '/VICO-PWA-HUB/' }
  };

  event.waitUntil(
    self.registration.showNotification(title, options)
  );
});

// ===== NOTIFICATION CLICK =====
self.addEventListener('notificationclick', event => {
  event.notification.close();
  event.waitUntil(
    clients.openWindow(event.notification.data.url || '/VICO-PWA-HUB/')
  );
});

// ===== MESSAGE =====
self.addEventListener('message', event => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
  if (event.data && event.data.type === 'GET_VERSION') {
    event.ports[0].postMessage({ version: CACHE_NAME });
  }
});