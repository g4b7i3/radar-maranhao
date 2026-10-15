/* Radar Corridas Maranhão — service worker.
   Página e agenda: busca sempre a versão nova na internet; sem internet, usa a última guardada.
   Arquivos do site (JS, CSS, fontes, ícones): guardados depois do primeiro acesso. */
const VERSION = 'v1';
const SHELL = `radar-shell-${VERSION}`;
const DATA = `radar-data-${VERSION}`;
const PRECACHE = ['/', '/manifest.webmanifest', '/favicon.svg', '/icons/icon-192.png', '/icons/apple-touch-icon.png'];

self.addEventListener('install', event => {
  event.waitUntil(caches.open(SHELL).then(c => c.addAll(PRECACHE)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(k => k.startsWith('radar-') && ![SHELL, DATA].includes(k)).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

async function networkFirst(request, cacheName, fallbackUrl) {
  const cache = await caches.open(cacheName);
  try {
    const fresh = await fetch(request);
    // só guarda como página inicial quando é ela mesma (não as páginas de cidade)
    if (fresh.ok && (!fallbackUrl || new URL(request.url).pathname === fallbackUrl)) cache.put(fallbackUrl || request, fresh.clone());
    return fresh;
  } catch {
    return (await cache.match(fallbackUrl || request, { ignoreSearch: true })) || Response.error();
  }
}

async function cacheFirst(request) {
  const cache = await caches.open(SHELL);
  const hit = await cache.match(request);
  if (hit) return hit;
  const fresh = await fetch(request);
  if (fresh.ok) cache.put(request, fresh.clone());
  return fresh;
}

self.addEventListener('fetch', event => {
  const { request } = event;
  if (request.method !== 'GET') return;
  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;
  if (url.pathname.startsWith('/calendario/')) return; // arquivos de calendário vão direto pro aparelho

  if (request.mode === 'navigate') {
    event.respondWith(networkFirst(request, SHELL, '/'));
  } else if (url.pathname.startsWith('/data/')) {
    event.respondWith(networkFirst(new Request(url.pathname, { cache: 'no-store' }), DATA));
  } else if (/^\/(assets|icons)\/|\.(woff2?|svg|png)$/.test(url.pathname)) {
    event.respondWith(cacheFirst(request));
  }
});
