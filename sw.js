'use strict';

const CACHE_VERSION = 'connect4-pwa-ghpages-v1';

// self.registration.scope is bijv. https://user.github.io/repo/
const SCOPE_URL = new URL(self.registration.scope);
const BASE_PATH = SCOPE_URL.pathname; // "/repo/"

function u(path) {
  // absolute URL binnen dezelfde origin
  return new URL(path.replace(/^\//, ''), self.registration.scope).toString();
}

const APP_SHELL = [
  u('./'),
  u('./index.html'),
  u('./styles.css'),
  u('./app.js'),
  u('./manifest.json'),
  u('./icons/icon-192.png'),
  u('./icons/icon-512.png')
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_VERSION).then((cache) => cache.addAll(APP_SHELL))
  );
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(keys.filter((k) => k !== CACHE_VERSION).map((k) => caches.delete(k)));
    await self.clients.claim();
  })());
});

async function cacheFirst(req) {
  const cache = await caches.open(CACHE_VERSION);
  const cached = await cache.match(req, { ignoreSearch: true });
  if (cached) return cached;

  const res = await fetch(req);
  if (res && res.ok) cache.put(req, res.clone());
  return res;
}

async function navFallback(req) {
  const cache = await caches.open(CACHE_VERSION);
  try {
    const res = await fetch(req);
    if (res && res.ok) cache.put(u('./index.html'), res.clone());
    return res;
  } catch {
    // ignoreSearch zodat ?source=pwa ook offline werkt
    return (await cache.match(req, { ignoreSearch: true })) ||
           (await cache.match(u('./index.html'), { ignoreSearch: true }));
  }
}

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;

  if (req.mode === 'navigate') {
    event.respondWith(navFallback(req));
    return;
  }

  const url = new URL(req.url);
  // alleen eigen origin en binnen dezelfde base path
  if (url.origin === self.location.origin && url.pathname.startsWith(BASE_PATH)) {
    event.respondWith(cacheFirst(req));
  }
});