// Service worker do vybe (GitHub Pages).
// - Páginas e dados (data/*.json): rede primeiro, cache como reserva → abre offline com o último ranking visto.
// - Arquivos do build (assets/*, com hash no nome) e ícones: cache primeiro.
// - Notificações: clique abre/foca o vybe.
const VERSION = 'vybe-v3';
const SHELL = `${VERSION}-shell`;
const DATA = `${VERSION}-data`;
const scope = new URL(self.registration.scope);
const PRECACHE = ['./', 'manifest.webmanifest', 'favicon.svg', 'icon-192.png', 'icon-512.png'].map((p) => new URL(p, scope).href);

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(SHELL).then((c) => c.addAll(PRECACHE)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((k) => !k.startsWith(VERSION)).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

async function networkFirst(req, cacheName) {
  const cache = await caches.open(cacheName);
  try {
    const res = await fetch(req);
    if (res.ok) cache.put(req, res.clone());
    return res;
  } catch (err) {
    const hit = (await cache.match(req, { ignoreSearch: req.mode === 'navigate' })) ?? (req.mode === 'navigate' ? await caches.match(new URL('./', scope).href) : null);
    if (hit) return hit;
    throw err;
  }
}

async function cacheFirst(req) {
  const hit = await caches.match(req);
  if (hit) return hit;
  const res = await fetch(req);
  if (res.ok) (await caches.open(SHELL)).put(req, res.clone());
  return res;
}

self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.origin !== scope.origin || !url.pathname.startsWith(scope.pathname)) return; // APIs externas: direto na rede
  const path = url.pathname.slice(scope.pathname.length);
  if (req.mode === 'navigate') return e.respondWith(networkFirst(req, SHELL));
  if (path.startsWith('data/')) return e.respondWith(networkFirst(req, DATA));
  if (path.startsWith('assets/') || /\.(png|svg|webmanifest|woff2?)$/.test(path)) return e.respondWith(cacheFirst(req));
});

// push do servidor (app fechado): { title, body, tag, url }
self.addEventListener('push', (e) => {
  let d = {};
  try {
    d = e.data ? e.data.json() : {};
  } catch {
    d = { body: e.data ? e.data.text() : '' };
  }
  e.waitUntil(
    self.registration.showNotification(d.title || 'vybe', {
      body: d.body || 'Novidades de quem você segue',
      tag: d.tag,
      icon: new URL('icon-192.png', scope).href,
      badge: new URL('icon-maskable-192.png', scope).href,
      data: { url: d.url || new URL('./?aba=seguindo', scope).href },
    }),
  );
});

self.addEventListener('notificationclick', (e) => {
  e.notification.close();
  const target = new URL(e.notification.data?.url ?? './', scope).href;
  e.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((list) => {
      const open = list.find((c) => c.url.startsWith(scope.href));
      if (open) {
        open.navigate?.(target);
        return open.focus();
      }
      return self.clients.openWindow(target);
    }),
  );
});

self.addEventListener('message', (e) => {
  if (e.data === 'skip-waiting') self.skipWaiting();
});
