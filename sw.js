// ══════════════════════════════════════════════════════
// SERVICE WORKER — Pilotage Cogedim
// Version: incrémentée à chaque déploiement GitHub
// Les données sont dans Supabase — seul le code est caché ici
// ══════════════════════════════════════════════════════

const VERSION = 'v1.0.0'; // ← incrémenter à chaque push GitHub
const CACHE_NAME = 'pilotage-cogedim-' + VERSION;

// Fichiers à mettre en cache (code de l'app)
const ASSETS = [
  '/pilotage-cogedim-dtn-dcn/',
  '/pilotage-cogedim-dtn-dcn/index.html',
  '/pilotage-cogedim-dtn-dcn/manifest.json',
  '/pilotage-cogedim-dtn-dcn/icon-192.png',
  '/pilotage-cogedim-dtn-dcn/icon-512.png',
];

// ── INSTALL : mise en cache du code ──
self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => {
      return cache.addAll(ASSETS).catch(err => {
        console.warn('SW: certains assets non cachés', err);
      });
    }).then(() => self.skipWaiting())
  );
});

// ── ACTIVATE : supprime les anciens caches ──
self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(
        keys
          .filter(key => key.startsWith('pilotage-cogedim-') && key !== CACHE_NAME)
          .map(key => {
            console.log('SW: suppression ancien cache', key);
            return caches.delete(key);
          })
      )
    ).then(() => self.clients.claim())
  );
});

// ── FETCH : stratégie Network First pour l'app, cache pour assets statiques ──
self.addEventListener('fetch', event => {
  const url = new URL(event.request.url);

  // Supabase et CDN → toujours réseau (jamais caché ici)
  if (url.hostname.includes('supabase.co') ||
      url.hostname.includes('jsdelivr.net') ||
      url.hostname.includes('fonts.googleapis.com') ||
      url.hostname.includes('fonts.gstatic.com')) {
    return; // passe à travers sans interception
  }

  // index.html → Network First (détecte les mises à jour)
  if (url.pathname.endsWith('/') || url.pathname.endsWith('index.html')) {
    event.respondWith(
      fetch(event.request)
        .then(response => {
          const clone = response.clone();
          caches.open(CACHE_NAME).then(cache => cache.put(event.request, clone));
          return response;
        })
        .catch(() => caches.match(event.request))
    );
    return;
  }

  // Autres assets → Cache First
  event.respondWith(
    caches.match(event.request).then(cached => {
      if (cached) return cached;
      return fetch(event.request).then(response => {
        if (response.ok) {
          const clone = response.clone();
          caches.open(CACHE_NAME).then(cache => cache.put(event.request, clone));
        }
        return response;
      });
    })
  );
});

// ── MESSAGE : demande de mise à jour depuis l'app ──
self.addEventListener('message', event => {
  if (event.data === 'SKIP_WAITING') {
    self.skipWaiting();
  }
  if (event.data === 'GET_VERSION') {
    event.source.postMessage({ type: 'VERSION', version: VERSION });
  }
});
