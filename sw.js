const CACHE = 'stasera-v5-stitch';
const ASSETS = ['./', 'index.html', 'css/style.css', 'js/safe.js', 'js/api.js',
  'js/routing.js', 'js/model.js', 'js/map.js', 'js/ui.js', 'js/app.js',
  'vendor/leaflet/leaflet.js', 'vendor/leaflet/leaflet.css', 'manifest.json', 'icon.svg'];
const ASSET_URLS = new Set(ASSETS.map(asset => new URL(asset, self.registration.scope).href));
self.addEventListener('install', event => {
  event.waitUntil(caches.open(CACHE).then(cache => cache.addAll(ASSETS)));
});
self.addEventListener('activate', event => {
  event.waitUntil(caches.keys().then(keys => Promise.all(
    keys.filter(key => key.startsWith('stasera-') && key !== CACHE).map(key => caches.delete(key))
  )).then(() => self.clients.claim()));
});
self.addEventListener('fetch', event => {
  if(event.request.method !== 'GET' || !ASSET_URLS.has(event.request.url)) return;
  // Versioned app shell: an active worker always serves one complete UI version.
  // A newly downloaded worker takes over after all old windows close.
  event.respondWith((async () => {
    const cache = await caches.open(CACHE);
    const cached = await cache.match(event.request);
    if(cached) return cached;
    return fetch(event.request);
  })());
});
