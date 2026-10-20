// Keeps a copy of Friend Garden's own files so it opens without the internet.
// Always asks the network first, so a new version arrives as soon as you're online.
const CACHE = 'friend-garden-v1';
const FILES = [
  './', 'index.html', 'style.css', 'manifest.webmanifest', 'icon.svg', 'icon-192.png',
  'js/main.js', 'js/plants.js', 'js/logic.js', 'js/store.js', 'js/sample.js', 'js/scene.js',
  'fonts/fonts.css', 'fonts/fraunces-latin.woff2', 'fonts/nunito-latin.woff2', 'fonts/caveat-latin.woff2',
];

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(FILES)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (e) => {
  e.waitUntil(caches.keys().then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
    .then(() => self.clients.claim()));
});

self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET' || new URL(req.url).origin !== location.origin) return;
  e.respondWith(fetch(req).then((res) => {
    if (res.ok) {
      const copy = res.clone();
      caches.open(CACHE).then((c) => c.put(req, copy));
    }
    return res;
  }).catch(() => caches.match(req, { ignoreSearch: true }).then((hit) => hit || caches.match('./'))));
});
