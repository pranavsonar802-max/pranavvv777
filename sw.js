/**
 * PRANAV SONAR — Progressive Web App Service Worker
 * Version: 2.1.0
 * Features:
 * - Offline precache for core shell
 * - Stale-While-Revalidate caching for static assets & styles
 * - Network-First / Direct for dynamic backend API routes (/api/*)
 * - Cache cleanup on activation
 */

const CACHE_NAME = 'ps-portfolio-cache-v2.1';

const PRECACHE_ASSETS = [
  '/',
  '/index.html',
  '/style.css',
  '/script.js',
  '/manifest.json',
  '/icon.svg',
  '/icon-maskable.svg',
  '/icon-192.png',
  '/icon-512.png',
  '/apple-touch-icon.png',
  '/vendor/html2canvas.min.js',
  '/vendor/jspdf.umd.min.js'
];

// Install Event — Precaching Core Shell
self.addEventListener('install', (event) => {
  self.skipWaiting();
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      console.log('[SW] Precaching core application assets...');
      return cache.addAll(PRECACHE_ASSETS).catch((err) => {
        console.warn('[SW] Precache non-critical asset skip:', err);
      });
    })
  );
});

// Activate Event — Clean Old Caches & Take Control Immediately
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((name) => {
          if (name !== CACHE_NAME) {
            console.log('[SW] Removing deprecated cache:', name);
            return caches.delete(name);
          }
        })
      );
    }).then(() => self.clients.claim())
  );
});

// Fetch Event — Smart Caching Strategy
self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);

  // 1. Bypass Service Worker for API endpoints (Always real-time data)
  if (url.pathname.startsWith('/api/')) {
    event.respondWith(
      fetch(event.request).catch(() => {
        return new Response(JSON.stringify({
          success: false,
          offline: true,
          error: 'Network connection unavailable. Request will sync when online.'
        }), {
          status: 503,
          headers: { 'Content-Type': 'application/json' }
        });
      })
    );
    return;
  }

  // 2. Ignore non-GET requests
  if (event.request.method !== 'GET') {
    return;
  }

  // 3. Stale-While-Revalidate for Static Assets
  event.respondWith(
    caches.match(event.request).then((cachedResponse) => {
      const fetchPromise = fetch(event.request).then((networkResponse) => {
        if (networkResponse && networkResponse.status === 200) {
          const responseToCache = networkResponse.clone();
          caches.open(CACHE_NAME).then((cache) => {
            cache.put(event.request, responseToCache);
          });
        }
        return networkResponse;
      }).catch((err) => {
        // Fallback for document navigation when offline
        if (event.request.mode === 'navigate') {
          return caches.match('/index.html');
        }
        throw err;
      });

      return cachedResponse || fetchPromise;
    })
  );
});
