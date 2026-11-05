// Safe service worker uninstaller
// Does NOT call skipWaiting() or clients.claim() to prevent unexpected browser page reloads.

self.addEventListener('install', () => {
  // Do not call self.skipWaiting()
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    Promise.all([
      self.registration.unregister(),
      typeof caches !== 'undefined'
        ? caches.keys().then((keys) => Promise.all(keys.map((k) => caches.delete(k))))
        : Promise.resolve(),
    ])
  );
});

// Pass-through all network requests directly
self.addEventListener('fetch', () => {});
