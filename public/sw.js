/* Radar Corridas Maranhão — service worker.
   Página e agenda: busca sempre a versão nova na internet; sem internet, usa a última guardada.
   Arquivos do site (JS, CSS, fontes, ícones): guardados depois do primeiro acesso. */
const VERSION = 'v3';
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

// ── Push: mostra a notificação e, ao tocar, abre o Radar Pro na aba certa
self.addEventListener('push', event => {
  let d = { titulo: 'Radar Pro', corpo: '', url: '/?pro', tag: 'radar' };
  try { d = { ...d, ...event.data.json() }; } catch { /* sem corpo */ }
  event.waitUntil(self.registration.showNotification(d.titulo, { body: d.corpo, icon: '/icons/pro-512.png', badge: '/icons/badge-96.png', tag: d.tag, data: { url: d.url }, vibrate: [80, 40, 80] }));
});
self.addEventListener('notificationclick', event => {
  event.notification.close();
  const url = event.notification.data?.url || '/?pro';
  event.waitUntil(self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then(lista => {
    const aberta = lista.find(c => c.url.includes('?pro'));
    if (aberta) { aberta.navigate(url); return aberta.focus(); }
    return self.clients.openWindow(url);
  }));
});
