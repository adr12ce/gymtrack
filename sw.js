/* =========================================================
   GymTrack · service worker · por adr12ce
   Guarda la app en el dispositivo para que abra sin conexión.
   - La página (index.html): primero la red (para recibir versiones nuevas) y, sin conexión, la copia guardada.
   - Iconos, librería de Supabase y fuentes: primero la copia guardada (rápido) y se actualizan por detrás.
   - Los datos (Supabase) y version.json nunca pasan por aquí: siempre van a la red.
   Al publicar una versión nueva, cambia VERSION (y también APP_VERSION en index.html y version.json).
   ========================================================= */
const VERSION = '6.0.0';
const CACHE = 'gymtrack-' + VERSION + '-b2';   // cambia la parte final para forzar que se renueve la copia guardada
const CORE = [
  './', './index.html', './manifest.webmanifest',
  './icon-192-v2.png', './icon-512-v2.png', './icon-maskable-v2.png', './apple-touch-icon-v2.png',
  'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.117.3/dist/umd/supabase.js'
];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(CORE)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(k => k.startsWith('gymtrack-') && k !== CACHE).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', e => {
  const req = e.request, url = new URL(req.url);
  if (req.method !== 'GET') return;
  if (url.hostname.endsWith('supabase.co') || url.hostname.endsWith('supabase.in')) return;   // datos: siempre a la red
  if (url.pathname.endsWith('/version.json')) return;                                          // comprobar versión: siempre a la red

  // la página y el manifiesto (nombre e icono de la app): primero la red y, sin conexión, la copia guardada
  if (req.mode === 'navigate' || (url.origin === location.origin && (url.pathname.endsWith('/index.html') || url.pathname.endsWith('.webmanifest')))) {
    e.respondWith(
      fetch(new Request(url.href, { cache: 'no-cache', credentials: 'same-origin' }))
        .then(res => {
          if (res.ok) { const copy = res.clone(), key = url.pathname.endsWith('.webmanifest') ? './manifest.webmanifest' : './index.html'; caches.open(CACHE).then(c => c.put(key, copy)); }
          return res;
        })
        .catch(() => url.pathname.endsWith('.webmanifest') ? caches.match('./manifest.webmanifest') : caches.match('./index.html').then(r => r || caches.match('./')))
    );
    return;
  }

  // el resto: copia guardada al momento y se actualiza en segundo plano
  e.respondWith(
    caches.match(req).then(hit => {
      const net = fetch(req).then(res => {
        if (res && (res.ok || res.type === 'opaque')) { const copy = res.clone(); caches.open(CACHE).then(c => c.put(req, copy)); }
        return res;
      }).catch(() => hit);
      return hit || net;
    })
  );
});
