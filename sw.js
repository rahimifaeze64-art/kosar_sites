// Service Worker for PWA functionality
// استراتژی: Network-First — همیشه آخرین نسخه از سرور
const CACHE_NAME = 'edu-system-v3';

// Install event — فقط فایل‌های ضروری offline
const urlsToCache = [
    '/manifest.json',
];

self.addEventListener('install', event => {
    // فوری فعال شو بدون صبر برای tab های قدیمی
    self.skipWaiting();
    event.waitUntil(
        caches.open(CACHE_NAME).then(cache => cache.addAll(urlsToCache))
    );
});

self.addEventListener('activate', event => {
    // همه cache های قدیمی رو پاک کن
    event.waitUntil(
        caches.keys().then(cacheNames => {
            return Promise.all(
                cacheNames.map(cacheName => {
                    if (cacheName !== CACHE_NAME) {
                        console.log('[SW] Deleting old cache:', cacheName);
                        return caches.delete(cacheName);
                    }
                })
            );
        }).then(() => self.clients.claim())
    );
});

// Fetch: Network-First
// همیشه اول از network بگیر، اگه offline بود از cache
self.addEventListener('fetch', event => {
    // فقط GET رو مدیریت کن
    if (event.request.method !== 'GET') return;

    // برای فایل‌های JS, CSS, HTML — همیشه network-first
    const url = new URL(event.request.url);
    const isLocalAsset = url.origin === self.location.origin;

    if (isLocalAsset) {
        event.respondWith(
            fetch(event.request)
                .then(response => {
                    // اگه موفق بود، cache رو هم آپدیت کن
                    if (response && response.status === 200) {
                        const responseClone = response.clone();
                        caches.open(CACHE_NAME).then(cache => {
                            cache.put(event.request, responseClone);
                        });
                    }
                    return response;
                })
                .catch(() => {
                    // فقط اگه offline بود، از cache برگردون
                    return caches.match(event.request);
                })
        );
    }
    // CDN و external — cache-first (این‌ها تغییر نمی‌کنن)
    else {
        event.respondWith(
            caches.match(event.request).then(cached => {
                return cached || fetch(event.request);
            })
        );
    }
});
