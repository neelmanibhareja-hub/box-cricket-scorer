const CACHE_NAME = 'cricket-v73';
const CDN_URLS = [
  'https://cdn.jsdelivr.net/npm/phaser@3.80.1/dist/phaser.min.js'
];
// relative, so it works at a site root (Netlify) and under /box-cricket-scorer/ (GitHub Pages)
const APP_SHELL = ['./', 'index.html'];

self.addEventListener('install', e => {
  e.waitUntil(
    caches.open(CACHE_NAME).then(cache =>
      Promise.all([
        cache.addAll(CDN_URLS).catch(() => {}),
        cache.addAll(APP_SHELL).catch(() => {})
      ])
    )
  );
  self.skipWaiting();
});

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k)))
    )
  );
  self.clients.claim();
});

self.addEventListener('fetch', e => {
  const url = new URL(e.request.url);
  if (url.pathname.includes('/webhook/')) return;
  if (e.request.mode === 'navigate' || url.pathname.endsWith('.html') || url.pathname === '/') {
    e.respondWith(
      fetch(e.request).then(response => {
        if (response.ok) {
          caches.open(CACHE_NAME).then(cache => cache.put(e.request, response.clone()));
        }
        return response;
      }).catch(() => caches.match(e.request).then(r => r || caches.match('index.html')))
    );
    return;
  }
  e.respondWith(
    caches.match(e.request).then(cached => {
      if (cached) return cached;
      return fetch(e.request).then(response => {
        if (response.ok) {
          caches.open(CACHE_NAME).then(cache => cache.put(e.request, response.clone()));
        }
        return response;
      });
    }).catch(() => {
      if (e.request.mode === 'navigate') return caches.match('index.html');
    })
  );
});

// ── PUSH NOTIFICATIONS ─────────────────────────────────
self.addEventListener('push', e => {
  let data = { title: '🏏 Box Cricket', body: 'Match update!', matchId: null };
  try { data = { ...data, ...e.data.json() }; } catch(err) {}
  e.waitUntil(
    self.registration.showNotification(data.title, {
      body: data.body,
      icon: '/icon-192.png',
      badge: '/icon-192.png',
      tag: 'cricket-' + (data.matchId || 'general'),
      renotify: true,
      data: { matchId: data.matchId }
    })
  );
});

self.addEventListener('notificationclick', e => {
  e.notification.close();
  const matchId = e.notification.data?.matchId;
  const url = matchId ? `/#live/${matchId}` : '/';
  e.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then(list => {
      for (const client of list) {
        if (client.url.includes(self.location.origin)) {
          client.focus();
          client.postMessage({ type: 'navigate', url });
          return;
        }
      }
      return clients.openWindow(url);
    })
  );
});
