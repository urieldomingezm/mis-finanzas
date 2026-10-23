// Service worker: permite instalar la app y abrirla aunque falle la red.
// Estrategia "red primero": siempre intenta traer la versión nueva.
const CACHE = 'misfinanzas-v8';
const ARCHIVOS = ['./', './index.html', './css/app.css', './app.js', './config.js', './manifest.json', './icon.svg', './icon-192.png', './vendor/supabase-2.118.0.js', './vendor/chart-4.4.1.js', './vendor/driver-1.10.2.js', './vendor/driver-1.10.2.css', './vendor/sweetalert2-11.26.25.js', './vendor/sweetalert2-11.26.25.css', './vendor/bootstrap-icons/bootstrap-icons.min.css', './vendor/bootstrap-icons/fonts/bootstrap-icons.woff2', './vendor/fonts/bricolage-grotesque-latin.woff2', './vendor/fonts/instrument-sans-latin.woff2'];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(ARCHIVOS)));
  self.skipWaiting();
});
self.addEventListener('activate', e => {
  e.waitUntil(caches.keys().then(ks => Promise.all(ks.filter(k => k !== CACHE).map(k => caches.delete(k)))));
  self.clients.claim();
});
self.addEventListener('fetch', e => {
  const url = new URL(e.request.url);
  if (e.request.method !== 'GET' || url.origin !== location.origin) return; // Supabase y CDNs van directo
  e.respondWith(
    fetch(e.request)
      .then(r => { const copia = r.clone(); caches.open(CACHE).then(c => c.put(e.request, copia)); return r; })
      .catch(() => caches.match(e.request))
  );
});

// Al tocar una notificación del navegador: abre (o enfoca) la app en la sección del aviso
self.addEventListener('notificationclick', e => {
  e.notification.close();
  const tab = e.notification.data?.tab || 'resumen';
  e.waitUntil(clients.matchAll({ type: 'window', includeUncontrolled: true }).then(lista => {
    const abierta = lista.find(c => c.url.startsWith(self.registration.scope));
    if (abierta) { abierta.postMessage({ tipo: 'abrir-tab', tab }); return abierta.focus(); }
    return clients.openWindow(self.registration.scope + '?tab=' + encodeURIComponent(tab));
  }));
});
