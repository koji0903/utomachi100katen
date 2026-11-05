// Safe self-destruct service worker
// Immediately claims waiting state to retire legacy Workbox service workers,
// unregisters itself, and wipes all CacheStorage without hijacking fetch events.

self.addEventListener('install', () => {
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    Promise.all([
      typeof caches !== 'undefined'
        ? caches.keys().then((keys) => Promise.all(keys.map((k) => caches.delete(k))))
        : Promise.resolve(),
      self.registration.unregister(),
    ])
  );
});
