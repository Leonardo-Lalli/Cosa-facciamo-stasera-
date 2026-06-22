const CACHE = 'stasera-v2';
const ASSETS = [
  '/Cosa-facciamo-stasera-/',
  '/Cosa-facciamo-stasera-/index.html',
  '/Cosa-facciamo-stasera-/css/style.css',
  '/Cosa-facciamo-stasera-/js/api.js',
  '/Cosa-facciamo-stasera-/js/routing.js',
  '/Cosa-facciamo-stasera-/js/describer.js',
  '/Cosa-facciamo-stasera-/js/planner.js',
  '/Cosa-facciamo-stasera-/js/map.js',
  '/Cosa-facciamo-stasera-/js/ui.js',
  '/Cosa-facciamo-stasera-/js/app.js',
  '/Cosa-facciamo-stasera-/manifest.json',
];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(ASSETS)));
});

self.addEventListener('fetch', e => {
  e.respondWith(
    caches.match(e.request).then(r => r || fetch(e.request))
  );
});
