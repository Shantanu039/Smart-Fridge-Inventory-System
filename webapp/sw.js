const CACHE_NAME = 'fridge-v8';

// Statutory static client-side application assets to commit to regional offline caches
const urlsToCache = [
    '/',
    'index.html',
    'cart.html',      
    'auth.html',      
    'style.css',
    'config.js',
    'db.js',
    'app.js',
    'api.js',
    'ui.js',
    'cart_logic.js',  
    'auth.js',        
    'manifest.json',
    'https://cdn-icons-png.flaticon.com/512/2274/2274757.png',
    'https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.0.0/css/all.min.css',
    'https://fonts.googleapis.com/css2?family=Inter:wght@400;600;700&display=swap'
];

/**
 * LIFECYCLE EVENT: Service Worker Installation
 * Establishes background target storage records and forces compilation pools.
 */
self.addEventListener('install', (event) => {
    event.waitUntil(
        caches.open(CACHE_NAME)
            .then((cache) => {
                console.log('SW: Pre-caching all assets with v7 structural presentation alignment fixes');
                return cache.addAll(urlsToCache);
            })
            .then(() => self.skipWaiting())
    );
});

/**
 * LIFECYCLE EVENT: Service Worker Activation
 * Iterates through system storage directories to clear out legacy caches.
 */
self.addEventListener('activate', (event) => {
    event.waitUntil(
        caches.keys().then((cacheNames) => {
            return Promise.all(
                cacheNames.map((cacheName) => {
                    if (cacheName !== CACHE_NAME) {
                        console.log('SW: Cleaning up legacy asset registers:', cacheName);
                        return caches.delete(cacheName);
                    }
                })
            );
        }).then(() => self.clients.claim())
    );
});

/**
 * TRANSACTION INTERCEPT ROUTINE: Fetch Middleware Gateway
 * Enforces a high-efficiency Network-First fallback caching pattern. Bypasses transaction 
 * state signatures and third-party cloud image recognition web spaces.
 */
self.addEventListener('fetch', (event) => {
    // Restrict monitoring to standard retrieval sequences only
    if (event.request.method !== 'GET') return;

    // DATA BUS PROTECTION FIREWALL: Prevent intercepting cloud processing domains
    if (event.request.url.includes('googleapis.com') || event.request.url.includes('openfoodfacts.org')) return;

    event.respondWith(
        fetch(event.request)
            .then((response) => {
                // If response meets basic criteria, store a cloned instance locally
                if (response && response.status === 200 && response.type === 'basic') {
                    const responseToCache = response.clone();
                    caches.open(CACHE_NAME).then((cache) => {
                        cache.put(event.request, responseToCache);
                    });
                }
                return response;
            })
            .catch(async () => {
                // Network pipeline failure hook. Re-route processing over to client-side cached assets.
                const cachedResponse = await caches.match(event.request);
                if (cachedResponse) {
                    return cachedResponse;
                }

                // Symmetrical complete connection drop-out timeout fallback text array
                return new Response('Offline: Resource not available in cache.', {
                    status: 408,
                    headers: { 'Content-Type': 'text/plain' }
                });
            })
    );
});