// Chaupar — service worker
// Keeps this deliberately minimal: this is a live multiplayer game, so we
// only cache the static app shell (HTML/manifest/icons), never game state.
// Socket.IO's realtime connection bypasses fetch/service-worker entirely,
// so it's unaffected by anything here.

const CACHE_NAME = 'chaupar-shell-v1';
const SHELL_FILES = [
  '/',
  '/manifest.json',
  '/icons/icon-192.png',
  '/icons/icon-512.png',
];

self.addEventListener('install', (event) => {
  self.skipWaiting();
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(SHELL_FILES)).catch(() => {})
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k)))
    ).then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return; // never intercept POST/socket.io polling writes

  // Network-first for the app shell itself, so a redeploy is picked up
  // immediately when online; fall back to the cached copy if offline.
  if (req.mode === 'navigate' || SHELL_FILES.includes(new URL(req.url).pathname)) {
    event.respondWith(
      fetch(req)
        .then((res) => {
          const copy = res.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(req, copy)).catch(() => {});
          return res;
        })
        .catch(() => caches.match(req))
    );
  }
  // Everything else (Socket.IO's HTTP polling/handshake, etc.) passes straight
  // through untouched — never served from cache.
});
