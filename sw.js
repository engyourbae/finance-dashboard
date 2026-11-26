const APP_VERSION = '41.0';
const CACHE_NAME = 'finance_app_version_' + APP_VERSION;
const ASSETS_TO_CACHE = [
    './',
    './index.html',
    './css/style.css?v=' + APP_VERSION,
    './js/main.js?v=' + APP_VERSION,
    './js/security.js?v=' + APP_VERSION,
    './js/supabase-client.js?v=' + APP_VERSION,
    './js/vendor/supabase.js?v=' + APP_VERSION,
    './js/vendor/chart.umd.js?v=' + APP_VERSION,
    './js/vendor/crypto-js.js?v=' + APP_VERSION,
    './manifest.json',
    './assets/icons/icon-192.png',
    './assets/icons/icon-512.png'
];

self.addEventListener('install', (event) => {
    event.waitUntil(caches.open(CACHE_NAME).then((cache) => cache.addAll(ASSETS_TO_CACHE)));
    self.skipWaiting();
});

self.addEventListener('activate', (event) => {
    event.waitUntil(
        caches.keys().then((names) => Promise.all(names.map((n) => (n !== CACHE_NAME ? caches.delete(n) : null))))
    );
    self.clients.claim();
});

// Network First untuk aset statis same-origin. Hanya same-origin yang disentuh; data Supabase (lintas origin) tidak pernah di-cache.
self.addEventListener('fetch', (event) => {
    const req = event.request;
    const url = new URL(req.url);
    if (req.method !== 'GET' || url.origin !== self.location.origin || /\/auth\/v1\/|\/rest\/v1\//.test(url.pathname)) return;
    event.respondWith(
        fetch(req)
            .then((res) => {
                if (res && res.status === 200 && res.type === 'basic') {
                    const copy = res.clone();
                    caches.open(CACHE_NAME).then((c) => c.put(req, copy));
                }
                return res;
            })
            .catch(() => caches.match(req).then((m) => m || caches.match('./index.html')))
    );
});
