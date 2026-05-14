const CACHE = 'jct-v33';
const BASE  = '/CTAPTracker';

self.addEventListener('install', e => {
  // Minimal precache — only URLs guaranteed to exist
  e.waitUntil(
    caches.open(CACHE).then(c => c.addAll([
      BASE + '/',
      BASE + '/index.html',
      BASE + '/app.js',
      BASE + '/data.js',
    ]))
  );
  self.skipWaiting();
});

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

// Network-first: always try network, fall back to cache when offline
self.addEventListener('fetch', e => {
  e.respondWith(
    fetch(e.request)
      .then(res => {
        if (res.ok) {
          const clone = res.clone();
          caches.open(CACHE).then(c => c.put(e.request, clone));
        }
        return res;
      })
      .catch(() => caches.match(e.request))
  );
});
