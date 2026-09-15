/* アプリを更新したら、この番号を1つ上げること。 */
const CACHE_VERSION = 'v5';

const SHELL_CACHE = `shell-${CACHE_VERSION}`;

const SHELL = [
  './',
  './index.html',
  './style.css',
  './app.js',
  './firebase.js',
  './ai.js',
  './manifest.webmanifest',
  './icons/icon-192.png',
];

self.addEventListener('install', (event) => {
  event.waitUntil(caches.open(SHELL_CACHE).then((cache) => cache.addAll(SHELL)));
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((names) =>
      Promise.all(names.filter((name) => name !== SHELL_CACHE).map((name) => caches.delete(name)))
    )
  );
  self.clients.claim();
});

async function networkFirst(request) {
  const cache = await caches.open(SHELL_CACHE);
  try {
    const response = await fetch(request);
    cache.put(request, response.clone());
    return response;
  } catch (error) {
    const cached = await cache.match(request) || await cache.match('./index.html');
    if (cached) return cached;
    throw error;
  }
}

self.addEventListener('fetch', (event) => {
  const { request } = event;
  if (request.method !== 'GET') return;

  const url = new URL(request.url);
  if (url.origin === self.location.origin) {
    event.respondWith(networkFirst(request));
  }
});
