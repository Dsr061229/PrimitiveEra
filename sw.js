/* 原始纪元 Service Worker —— 网络优先+缓存兜底：有网自动更新，无网离线可玩 */
const CACHE = 'pe-v3';
const ASSETS = [
  './', './index.html', './manifest.webmanifest', './icon-192.png', './icon-512.png',
  './src/core.js', './src/input.js', './src/audio.js', './src/data.js', './src/sprites.js',
  './src/fx.js', './src/world.js', './src/player.js', './src/enemies.js', './src/systems.js',
  './src/ui.js', './src/main.js',
];
self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(ASSETS)).then(() => self.skipWaiting()));
});
self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys().then(ks => Promise.all(ks.filter(k => k !== CACHE).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});
self.addEventListener('fetch', e => {
  if (e.request.method !== 'GET' || !e.request.url.startsWith(self.location.origin)) return;
  e.respondWith(
    fetch(e.request).then(r => {
      const cp = r.clone();
      caches.open(CACHE).then(c => c.put(e.request, cp));
      return r;
    }).catch(() => caches.match(e.request, { ignoreSearch: true }))
  );
});
