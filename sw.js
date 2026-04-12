// ============================================================
// VICO PWA HUB — Service Worker v3
// Estrategia: Cache-first para assets, Network-first para API
// ============================================================

const CACHE_NAME   = 'vico-pwa-hub-v3';
const STATIC_FILES = [
  './',
  './index.html',
  './manifest.json',
  './icon.png'
];

// ===== INSTALL — pre-cache static assets =====
self.addEventListener('install', event => {
  self.skipWaiting();
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => {
      return cache.addAll(STATIC_FILES).catch(err => {
        console.warn('[SW] Pre-cache partial fail:', err);
      });
    })
  );
});

// ===== ACTIVATE — purge old caches =====
self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(
        keys
          .filter(key => key !== CACHE_NAME)
          .map(key => {
            console.log('[SW] Deleting old cache:', key);
            return caches.delete(key);
          })
      )
    ).then(() => self.clients.claim())
  );
});

// ===== FETCH — smart routing =====
self.addEventListener('fetch', event => {
  const { request } = event;
  const url = new URL(request.url);

  // Skip non-GET
  if (request.method !== 'GET') return;

  // Skip external API calls (Anthropic, OpenAI, Gemini, Groq, Drive)
  const apiHosts = [
    'api.anthropic.com',
    'api.openai.com',
    'generativelanguage.googleapis.com',
    'api.groq.com',
    'www.googleapis.com',
    'accounts.google.com'
  ];
  if (apiHosts.some(h => url.hostname.includes(h))) return;

  // Skip Monaco CDN — large, handled by browser cache
  if (url.hostname.includes('cdnjs.cloudflare.com')) return;

  // For same-origin requests: Cache-first with network fallback
  if (url.origin === self.location.origin || url.protocol === 'content:') {
    event.respondWith(
      caches.match(request).then(cached => {
        if (cached) return cached;

        return fetch(request.clone()).then(response => {
          if (!response || response.status !== 200 || response.type === 'error') {
            return response;
          }
          // Cache successful responses
          const clone = response.clone();
          caches.open(CACHE_NAME).then(cache => cache.put(request, clone));
          return response;
        }).catch(() => {
          // Offline fallback for HTML navigation
          if (request.headers.get('Accept')?.includes('text/html')) {
            return caches.match('./index.html');
          }
        });
      })
    );
    return;
  }
});

// ===== PUSH NOTIFICATIONS =====
self.addEventListener('push', event => {
  const data = event.data?.json() || {
    title: 'VICO PWA HUB ⚡',
    body: '¡Tienes novedades en tus apps!',
    icon: './icon.png'
  };
  event.waitUntil(
    self.registration.showNotification(data.title, {
      body: data.body,
      icon: data.icon || './icon.png',
      badge: './icon.png',
      vibrate: [200, 100, 200],
      data: data.url || './'
    })
  );
});

self.addEventListener('notificationclick', event => {
  event.notification.close();
  const url = event.notification.data || './';
  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then(list => {
      for (const client of list) {
        if (client.url.includes('index.html') && 'focus' in client) {
          return client.focus();
        }
      }
      if (clients.openWindow) return clients.openWindow(url);
    })
  );
});

// ===== BACKGROUND SYNC (offline queue) =====
self.addEventListener('sync', event => {
  if (event.tag === 'sync-data') {
    console.log('[SW] Background sync triggered');
  }
});

console.log('[SW] VICO PWA HUB v3 loaded ✅');
