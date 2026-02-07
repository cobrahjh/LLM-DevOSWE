/**
 * SimGlass Service Worker
 * Enables offline caching and PWA functionality
 */

const CACHE_NAME = 'simglass-v1';
const OFFLINE_URL = '/ui/offline.html';

// Assets to cache immediately on install
const PRECACHE_ASSETS = [
    '/ui/shared/widget-common.css',
    '/ui/shared/themes.css',
    '/ui/shared/settings-panel.css',
    '/ui/shared/settings-panel.js',
    '/ui/shared/theme-switcher.js',
    '/ui/shared/voice-announcer.js',
    '/ui/shared/widget-customizer.js',
    '/ui/shared/widget-customizer.css',
    '/ui/offline.html'
];

// Install - precache core assets
self.addEventListener('install', (event) => {
    event.waitUntil(
        caches.open(CACHE_NAME).then((cache) => {
            console.log('[SW] Precaching core assets');
            return cache.addAll(PRECACHE_ASSETS);
        })
    );
    self.skipWaiting();
});

// Activate - clean old caches
self.addEventListener('activate', (event) => {
    event.waitUntil(
        caches.keys().then((cacheNames) => {
            return Promise.all(
                cacheNames
                    .filter((name) => name !== CACHE_NAME)
                    .map((name) => {
                        console.log('[SW] Removing old cache:', name);
                        return caches.delete(name);
                    })
            );
        })
    );
    self.clients.claim();
});

// Fetch - network first, cache fallback
self.addEventListener('fetch', (event) => {
    const { request } = event;
    const url = new URL(request.url);

    // Skip non-GET requests
    if (request.method !== 'GET') return;

    // Skip WebSocket and API requests
    if (url.pathname.startsWith('/api/') || url.pathname.startsWith('/ws')) {
        return;
    }

    // Skip external requests (CDNs like Leaflet)
    if (url.origin !== location.origin) {
        event.respondWith(
            fetch(request).catch(() => caches.match(request))
        );
        return;
    }

    // Network first strategy for HTML
    if (request.headers.get('accept')?.includes('text/html')) {
        event.respondWith(
            fetch(request)
                .then((response) => {
                    // Cache successful responses
                    if (response.ok) {
                        const clone = response.clone();
                        caches.open(CACHE_NAME).then((cache) => {
                            cache.put(request, clone);
                        });
                    }
                    return response;
                })
                .catch(() => {
                    // Return cached version or offline page
                    return caches.match(request).then((cached) => {
                        return cached || caches.match(OFFLINE_URL);
                    });
                })
        );
        return;
    }

    // Cache first for static assets (CSS, JS, images)
    event.respondWith(
        caches.match(request).then((cached) => {
            if (cached) {
                // Return cache but update in background
                fetch(request).then((response) => {
                    if (response.ok) {
                        caches.open(CACHE_NAME).then((cache) => {
                            cache.put(request, response);
                        });
                    }
                });
                return cached;
            }

            // Not in cache, fetch and cache
            return fetch(request).then((response) => {
                if (response.ok) {
                    const clone = response.clone();
                    caches.open(CACHE_NAME).then((cache) => {
                        cache.put(request, clone);
                    });
                }
                return response;
            });
        })
    );
});

// Handle messages from clients
self.addEventListener('message', (event) => {
    if (event.data === 'skipWaiting') {
        self.skipWaiting();
    }
});
