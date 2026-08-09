// Offline service worker.
//
// The game is ~2.5 MB of static files with no build step and no runtime
// network calls, so "works offline" only ever needed a cache that survives a
// dropped connection. Without this it relied on Chrome's HTTP cache, which
// Android evicts aggressively — exactly the wrong behaviour for a classroom
// on bad wifi.
//
// The footgun this file has to avoid is staleness: cache the app forever and a
// pushed fix never reaches a phone that already loaded it. Three things guard
// against that:
//   1. CACHE carries a version. Bump it and every old cache is deleted on
//      activate, so there is one obvious lever and no partial upgrades.
//   2. skipWaiting + clients.claim, so a new worker takes over on the next
//      load rather than waiting for every tab to close.
//   3. Navigations are network-first. The HTML is what points at everything
//      else, so if the network is up, the phone always learns about a new
//      build; only assets are cache-first.
//
// BUMP CACHE ON EVERY DEPLOY.
const CACHE = 'towcb-v1';

// Enumerated rather than globbed: no build step here, so there is nothing to
// generate a manifest, and an explicit list is greppable and diffable. Missing
// an entry costs an offline miss, never a broken online load.
const ASSETS = [
  './',
  './index.html',
  './css/style.css',
  './manifest.webmanifest',
  './icon.svg',
  './vendor/three.module.js',
  './vendor/three.core.js',
  './src/main.js',
  './src/constants.js',
  './src/strings.js',
  './src/save.js',
  './src/audio.js',
  './src/engine/renderer.js',
  './src/engine/input.js',
  './src/world/voxel.js',
  './src/world/blocks.js',
  './src/world/atlas.js',
  './src/world/mesher.js',
  './src/world/merge.js',
  './src/world/terrain.js',
  './src/world/states.js',
  './src/world/props.js',
  './src/player/player.js',
  './src/npc/npc.js',
  './src/npc/ambient.js',
  './src/fx/fx.js',
  './src/acts/beats.js',
  './src/acts/act1.js',
  './src/acts/act2.js',
  './src/acts/act3.js',
  './src/sky/dial.js',
  './src/sky/erosion.js',
  './src/sky/interstitial.js',
  './src/ui/hud.js',
  './src/ui/minigames.js',
  './src/ui/paint.js',
  './src/ui/pot.js',
  './src/ui/report.js',
];
// src/dev/* and vendor/gltf/* are deliberately absent: the world editor is
// dev-only and reached by dynamic import behind ?edit / F2, so precaching it
// would put 246 KB on every phone that will never open it.

self.addEventListener('install', (e) => {
  // addAll fails the whole install if any entry 404s, which is the behaviour
  // we want — a half-populated cache is worse than none.
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(ASSETS)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return; // never touch cross-origin

  // Navigations: network first, so a deployed fix is picked up as soon as the
  // phone has a connection. Cache is the fallback, which is the offline path.
  if (req.mode === 'navigate') {
    e.respondWith(
      fetch(req)
        .then((res) => {
          const copy = res.clone();
          caches.open(CACHE).then((c) => c.put(req, copy));
          return res;
        })
        .catch(() => caches.match(req).then((r) => r || caches.match('./index.html')))
    );
    return;
  }

  // Assets: cache first. They are versioned by CACHE, so a bump refetches all
  // of them and nothing can serve a stale module against fresh HTML.
  e.respondWith(
    caches.match(req).then((hit) => hit || fetch(req).then((res) => {
      if (res.ok && res.type === 'basic') {
        const copy = res.clone();
        caches.open(CACHE).then((c) => c.put(req, copy));
      }
      return res;
    }))
  );
});
