/* Service worker for the deck PWA. VERSION changes whenever the page changes, so browsers see a new
   sw.js, install it in the background and the page offers an Update button (nothing switches by itself). */
const VERSION = 'a8e4399b2dc4';
const CACHE = 'deck-' + VERSION;
const FONTS = 'deck-fonts';
const CORE = ['./', 'index.html', 'manifest.webmanifest', 'icons/icon-192.png', 'icons/icon-512.png',
              'icons/apple-touch-icon.png', 'icons/favicon-32.png'];

self.addEventListener('install', function (e) {
  e.waitUntil(caches.open(CACHE).then(function (c) {
    return c.addAll(CORE.map(function (u) { return new Request(u, { cache: 'reload' }); }));
  }));
});

self.addEventListener('message', function (e) {
  if (e.data && e.data.type === 'SKIP_WAITING') { self.skipWaiting(); }
});

self.addEventListener('activate', function (e) {
  e.waitUntil(caches.keys().then(function (keys) {
    return Promise.all(keys.filter(function (k) { return k.indexOf('deck-') === 0 && k !== CACHE && k !== FONTS; })
                           .map(function (k) { return caches.delete(k); }));
  }).then(function () { return self.clients.claim(); }));
});

self.addEventListener('fetch', function (e) {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.origin === location.origin) {
    // the page and its files: cache first, so the installed version stays put until the user taps Update
    e.respondWith(caches.match(req, { ignoreSearch: true }).then(function (hit) {
      return hit || fetch(req).catch(function () {
        return req.mode === 'navigate' ? caches.match('index.html') : Response.error();
      });
    }));
  } else if (url.hostname === 'fonts.googleapis.com' || url.hostname === 'fonts.gstatic.com') {
    // web fonts: serve the cached copy at once and refresh it in the background
    e.respondWith(caches.open(FONTS).then(function (c) {
      return c.match(req).then(function (hit) {
        const net = fetch(req).then(function (res) { if (res && (res.ok || res.type === 'opaque')) c.put(req, res.clone()); return res; })
                              .catch(function () { return hit; });
        return hit || net;
      });
    }));
  }
  // everything else (for example the GitHub API call for the update time) goes straight to the network
});
