/**
 * BeautifyPRO - Service Worker
 * Handles push notifications and offline caching
 */

const CACHE_NAME = 'beauty-v1';
const OFFLINE_URL = '/offline';

// Assets to cache on install
const STATIC_ASSETS = [
  '/',
  '/offline',
  '/icons/icon-192x192.png',
  '/icons/icon-512x512.png',
  '/icons/badge-72x72.png',
];

// ============================================
// INSTALL EVENT
// ============================================

self.addEventListener('install', (event) => {
  console.log('[SW] Installing service worker...');

  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      console.log('[SW] Caching static assets');
      return cache.addAll(STATIC_ASSETS).catch((err) => {
        console.warn('[SW] Failed to cache some assets:', err);
      });
    })
  );

  // Activate immediately
  self.skipWaiting();
});

// ============================================
// ACTIVATE EVENT
// ============================================

self.addEventListener('activate', (event) => {
  console.log('[SW] Activating service worker...');

  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames
          .filter((name) => name !== CACHE_NAME)
          .map((name) => {
            console.log('[SW] Deleting old cache:', name);
            return caches.delete(name);
          })
      );
    })
  );

  // Take control immediately
  self.clients.claim();
});

// ============================================
// PUSH EVENT
// ============================================

self.addEventListener('push', (event) => {
  console.log('[SW] Push received:', event);

  let data = {
    title: 'BeautifyPRO',
    body: 'Sie haben eine neue Benachrichtigung',
    icon: '/icons/icon-192x192.png',
    badge: '/icons/badge-72x72.png',
    tag: 'default',
    data: {},
  };

  try {
    if (event.data) {
      const payload = event.data.json();
      data = { ...data, ...payload };
    }
  } catch (err) {
    console.error('[SW] Failed to parse push data:', err);
  }

  const options = {
    body: data.body,
    icon: data.icon,
    badge: data.badge,
    tag: data.tag,
    data: data.data,
    actions: data.actions || [],
    requireInteraction: data.requireInteraction || false,
    renotify: data.renotify || false,
    silent: data.silent || false,
    vibrate: data.vibrate || [200, 100, 200],
  };

  if (data.image) {
    options.image = data.image;
  }

  event.waitUntil(
    self.registration.showNotification(data.title, options)
  );
});

// ============================================
// NOTIFICATION CLICK EVENT
// ============================================

self.addEventListener('notificationclick', (event) => {
  console.log('[SW] Notification clicked:', event);

  event.notification.close();

  const action = event.action;
  const data = event.notification.data || {};

  // Handle different actions
  let url = '/';

  if (action === 'view' || action === 'book') {
    url = data.url || '/dashboard';
  } else if (action === 'dismiss') {
    // Just close the notification
    return;
  } else if (data.url) {
    url = data.url;
  }

  // Open or focus the app
  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
      // Check if there's already a window open
      for (const client of clientList) {
        if (client.url.includes(self.registration.scope) && 'focus' in client) {
          client.navigate(url);
          return client.focus();
        }
      }

      // Open a new window
      if (clients.openWindow) {
        return clients.openWindow(url);
      }
    })
  );

  // Track click (send to server)
  if (data.trackingId) {
    fetch('/api/push/track-click', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ notificationId: data.trackingId }),
    }).catch((err) => console.warn('[SW] Failed to track click:', err));
  }
});

// ============================================
// NOTIFICATION CLOSE EVENT
// ============================================

self.addEventListener('notificationclose', (event) => {
  console.log('[SW] Notification closed:', event);
});

// ============================================
// FETCH EVENT (Offline support)
// ============================================

self.addEventListener('fetch', (event) => {
  // Only handle GET requests
  if (event.request.method !== 'GET') {
    return;
  }

  // Skip cross-origin requests
  if (!event.request.url.startsWith(self.location.origin)) {
    return;
  }

  // Skip API requests and auth
  if (
    event.request.url.includes('/api/') ||
    event.request.url.includes('/auth/')
  ) {
    return;
  }

  event.respondWith(
    caches.match(event.request).then((cachedResponse) => {
      if (cachedResponse) {
        // Return cached version and update in background
        event.waitUntil(
          fetch(event.request)
            .then((response) => {
              if (response.ok) {
                caches.open(CACHE_NAME).then((cache) => {
                  cache.put(event.request, response.clone());
                });
              }
            })
            .catch(() => {})
        );
        return cachedResponse;
      }

      // Fetch from network
      return fetch(event.request)
        .then((response) => {
          // Cache successful responses for static assets
          if (response.ok && event.request.destination === 'image') {
            const responseClone = response.clone();
            caches.open(CACHE_NAME).then((cache) => {
              cache.put(event.request, responseClone);
            });
          }
          return response;
        })
        .catch(() => {
          // Return offline page for navigation requests
          if (event.request.mode === 'navigate') {
            return caches.match(OFFLINE_URL);
          }
          return new Response('Offline', { status: 503 });
        });
    })
  );
});

// ============================================
// MESSAGE EVENT (Communication with app)
// ============================================

self.addEventListener('message', (event) => {
  console.log('[SW] Message received:', event.data);

  if (event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }

  if (event.data.type === 'CLEAR_CACHE') {
    caches.delete(CACHE_NAME).then(() => {
      console.log('[SW] Cache cleared');
    });
  }
});

console.log('[SW] Service worker loaded');
