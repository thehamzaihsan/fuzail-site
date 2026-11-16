// Offline cache for AXIS. Code and data (html/js/css/json) are fetched network-first so an update is picked up on the
// next load. The big files (models, Three.js) are served from the cache at once and refreshed in the background, so a
// re-exported model shows up on the following visit instead of being stuck in the cache forever.
// Bump CACHE when files are renamed or removed.
const CACHE = 'axis-web-2';
const FILES = [
  './', './index.html', './css/axis.css', './manifest.webmanifest',
  './js/main.js', './js/ui.js', './js/anatomy.js', './js/physiology.js', './js/particles.js',
  './js/procedures/stent.js', './js/circulation.js', './js/flowpaths.js', './js/hand.js', './js/guides.js', './js/procedures/puncture.js', './js/labels.js', './js/info.js', './js/explode.js', './js/kidney.js',
  './lib/three/three.module.js', './lib/three/addons/controls/OrbitControls.js', './lib/three/addons/loaders/GLTFLoader.js',
  './lib/three/addons/utils/BufferGeometryUtils.js', './lib/three/addons/environments/RoomEnvironment.js',
  './lib/three/addons/loaders/DRACOLoader.js', './lib/three/addons/libs/draco/draco_wasm_wrapper.js', './lib/three/addons/libs/draco/draco_decoder.wasm',
  './assets/thorax.glb', './assets/heart_cutaway.glb', './assets/lad_path.json', './assets/anatomy_extra.json', './assets/kidneys.glb', './assets/cutflow.json', './assets/flowpaths_user.json',
  './icons/icon-192.png', './icons/icon-512.png'
];
self.addEventListener('install', e => e.waitUntil(caches.open(CACHE).then(c => c.addAll(FILES)).then(() => self.skipWaiting())));
self.addEventListener('activate', e => e.waitUntil(caches.keys().then(ks => Promise.all(ks.filter(k => k !== CACHE).map(k => caches.delete(k)))).then(() => self.clients.claim())));
self.addEventListener('fetch', e => {
  if (e.request.method !== 'GET') return;
  const url = new URL(e.request.url), big = /\.(glb|png|txt|wasm)$/.test(url.pathname) || url.pathname.includes('/lib/');
  const save = res => { if (res.ok) { const copy = res.clone(); caches.open(CACHE).then(c => c.put(e.request, copy)); } return res; };
  e.respondWith(big
    ? caches.match(e.request).then(r => { const net = fetch(e.request).then(save).catch(() => r); if (r) { e.waitUntil(net); return r; } return net; })
    : fetch(e.request).then(save).catch(() => caches.match(e.request)));
});
