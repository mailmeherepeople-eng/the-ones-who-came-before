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
//   3. Every request is network-first, with the cache as the offline fallback
//      (see the fetch handler below for why cache-first was wrong here).
//
// BUMP CACHE ON EVERY DEPLOY.
const CACHE = 'towcb-v3';

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
  './src/settings.js',
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

// NETWORK FIRST for everything, cache as the fallback.
//
// This started as cache-first for assets, which is the usual advice, and it
// was wrong here. A cache-first worker serves the PREVIOUS build's modules on
// the first load after a deploy: navigations fetched fresh HTML, that HTML
// pulled its modules straight out of the old cache, and the page ran yesterday's
// code. Only the second load came good. Caught on the live site, where a fresh
// deploy booted with no settings button and no action rail.
//
// Network-first inverts the trade in the right direction for this project. The
// offline promise is intact, because a failed fetch falls back to the cache,
// and the whole game is 2.5 MB of small files that revalidate quickly. What it
// buys is that an online player is NEVER a version behind, which matters far
// more than shaving a few hundred milliseconds off a repeat load.
self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return; // never touch cross-origin

  e.respondWith(
    fetch(req)
      .then((res) => {
        if (res.ok && res.type === 'basic') {
          const copy = res.clone();
          caches.open(CACHE).then((c) => c.put(req, copy));
        }
        return res;
      })
      .catch(() => caches.match(req).then((hit) => (
        hit || (req.mode === 'navigate' ? caches.match('./index.html') : undefined)
      )))
  );
});
