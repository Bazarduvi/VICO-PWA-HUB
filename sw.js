// ===== PWA MANAGER PRO — SERVICE WORKER =====
// Versión: 1.0.0
// Estrategia: Cache First con fallback a red

const CACHE_NAME = 'pwa-manager-pro-v1';
const CACHE_VERSION = 1;

// Archivos esenciales que se cachean en la instalación
const ASSETS_TO_CACHE = [
  '/',
  '/index.html',
  '/manifest.json',
  '/icon.png'
];

// ===== INSTALL =====
// Se ejecuta cuando el SW se instala por primera vez
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
        // Activa el nuevo SW inmediatamente sin esperar
        return self.skipWaiting();
      })
      .catch(err => {
        console.error('[SW] Error durante la instalación:', err);
      })
  );
});

// ===== ACTIVATE =====
// Se ejecuta cuando el SW toma control.
// Limpia caches de versiones anteriores.
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
        // Toma control de todas las pestañas abiertas inmediatamente
        return self.clients.claim();
      })
  );
});

// ===== FETCH =====
// Intercepta todas las peticiones de red
self.addEventListener('fetch', event => {
  // Solo manejamos peticiones GET
  if (event.request.method !== 'GET') return;

  // Ignoramos peticiones a otros orígenes (APIs externas, CDNs, etc.)
  const url = new URL(event.request.url);
  if (url.origin !== self.location.origin) return;

  event.respondWith(
    caches.match(event.request)
      .then(cachedResponse => {
        // Si está en cache, lo devolvemos inmediatamente (Cache First)
        if (cachedResponse) {
          // En paralelo, actualizamos el cache con la versión más reciente de la red
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
            .catch(() => {
              // Si la red falla, no importa, ya tenemos el cache
            });
          
          return cachedResponse;
        }

        // Si no está en cache, lo pedimos a la red
        return fetch(event.request)
          .then(networkResponse => {
            // Verificamos que la respuesta sea válida
            if (!networkResponse || networkResponse.status !== 200 || networkResponse.type === 'error') {
              return networkResponse;
            }

            // Guardamos una copia en el cache para futuras visitas
            const responseClone = networkResponse.clone();
            caches.open(CACHE_NAME).then(cache => {
              cache.put(event.request, responseClone);
            });

            return networkResponse;
          })
          .catch(() => {
            // Si la red falla y no hay cache, mostramos la página offline
            if (event.request.destination === 'document') {
              return caches.match('/index.html');
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
    icon: '/icon.png',
    badge: '/icon.png',
    vibrate: [100, 50, 100],
    data: { url: data.url || '/' }
  };

  event.waitUntil(
    self.registration.showNotification(title, options)
  );
});

// ===== NOTIFICATION CLICK =====
self.addEventListener('notificationclick', event => {
  event.notification.close();
  event.waitUntil(
    clients.openWindow(event.notification.data.url || '/')
  );
});

// ===== MESSAGE =====
// Permite comunicación desde la app principal al SW
self.addEventListener('message', event => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
  if (event.data && event.data.type === 'GET_VERSION') {
    event.ports[0].postMessage({ version: CACHE_NAME });
  }
});
