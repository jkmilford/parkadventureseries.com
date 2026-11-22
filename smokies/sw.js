// Great Smoky Mountains Bear Game — offline / fast-start helper.
// The game page opens instantly from the saved copy, while a fresh copy is
// checked in the background. If you've uploaded a new index.html, players get
// a "new version is ready" button. You never need to edit this file.
const CACHE = 'smokies-game';
const SCOPE = self.registration.scope;              // e.g. https://example.com/smokies/
const PAGE = SCOPE;                                 // the game page is cached under the folder URL
const EXTRAS = ['manifest.webmanifest', 'icon-192.png', 'icon-512.png', 'icon-maskable-512.png', 'apple-touch-icon.png'].map((f) => SCOPE + f);

self.addEventListener('install', (e) => {
  e.waitUntil((async () => {
    const c = await caches.open(CACHE);
    try { const r = await fetch(PAGE, { cache: 'no-cache' }); if (r.ok) await c.put(PAGE, r); } catch (err) {}
    await Promise.all(EXTRAS.map((u) => fetch(u).then((r) => r.ok && c.put(u, r)).catch(() => {})));
  })());
  self.skipWaiting();
});

self.addEventListener('activate', (e) => {
  e.waitUntil((async () => {
    for (const k of await caches.keys()) if (k !== CACHE) await caches.delete(k);
    await self.clients.claim();
  })());
});

function isGamePage(url) {
  return url === SCOPE || url === SCOPE + 'index.html';
}

async function refreshPage(c) {
  try {
    const prev = await c.match(PAGE);               // a separate copy: the one sent to the page is already in use
    const old = prev ? await prev.text() : null;
    const r = await fetch(PAGE, { cache: 'no-cache' });
    if (!r.ok) return;
    const fresh = await r.clone().text();
    await c.put(PAGE, r);
    if (old !== null && old !== fresh) {
      for (const cl of await self.clients.matchAll({ type: 'window' })) cl.postMessage({ type: 'game-updated' });
    }
  } catch (err) { /* offline: keep the saved copy */ }
}

self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = req.url.split('#')[0].split('?')[0];
  if (isGamePage(url)) {
    e.respondWith((async () => {
      const c = await caches.open(CACHE);
      const cached = await c.match(PAGE);
      if (cached) {
        e.waitUntil(refreshPage(c));
        return cached;
      }
      try {
        const r = await fetch(req);
        if (r.ok) c.put(PAGE, r.clone());
        return r;
      } catch (err) {
        return new Response('You’re offline and the game hasn’t been saved on this device yet. Connect once, then it will work offline.', { status: 503, headers: { 'Content-Type': 'text/plain; charset=utf-8' } });
      }
    })());
    return;
  }
  if (EXTRAS.includes(url)) {
    e.respondWith(caches.match(url).then((hit) => hit || fetch(req)));
  }
  // everything else (other pages on the site, Amazon links) goes straight to the network
});
