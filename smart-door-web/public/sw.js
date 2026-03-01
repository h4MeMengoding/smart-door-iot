// Smart Door Lock — Service Worker v3
// ====================================
// CACHE POLICY:
//   - API routes (/api/*) → NEVER cached, always network (real-time MQTT data)
//   - WebSocket/MQTT (wss://) → Not intercepted (different origin)
//   - Navigation (HTML pages) → Network-only, NO cache (ensures fresh React bundles)
//   - Static assets (/_next/static/*) → Cache-first (hashed filenames = immutable)
//   - Favicon/icons → Cache-first (rarely change)
//
// GUARANTEE: All data from MQTT and API is always fetched from network.
//            Cache is ONLY used for immutable static assets (JS/CSS with content hash).

const CACHE_NAME = 'smart-door-v3';

// Only pre-cache icons (small, static, needed for notifications)
const PRECACHE_URLS = [
  '/favicon/android-chrome-192x192.png',
  '/favicon/android-chrome-512x512.png',
  '/favicon/favicon-32x32.png',
];

// ─── Install ───
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) =>
      cache.addAll(PRECACHE_URLS).catch(() => {})
    )
  );
  self.skipWaiting();
});

// ─── Activate ───
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys
          .filter((k) => k !== CACHE_NAME)
          .map((k) => caches.delete(k))
      )
    ).then(() => self.clients.claim())
  );
});

// ─── Fetch ───
self.addEventListener('fetch', (event) => {
  const { request } = event;

  // 1. Skip ALL non-GET requests (POST, PUT, DELETE, etc.)
  if (request.method !== 'GET') return;

  const url = new URL(request.url);

  // 2. NEVER cache API routes — data must always be real-time
  if (url.pathname.startsWith('/api/')) return;

  // 3. NEVER cache navigation requests (HTML pages)
  //    Always fetch from network to ensure latest React/Next.js bundles
  if (request.mode === 'navigate') return;

  // 4. Cache-first for Next.js immutable static assets only
  //    These have content hashes in filenames (e.g., _next/static/chunks/abc123.js)
  //    so they are safe to cache permanently — new deploys = new filenames
  if (url.pathname.startsWith('/_next/static/')) {
    event.respondWith(
      caches.match(request).then((cached) => {
        if (cached) return cached;
        return fetch(request).then((response) => {
          if (response.ok) {
            const clone = response.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(request, clone));
          }
          return response;
        });
      })
    );
    return;
  }

  // 5. Cache-first for favicon/icons only
  if (url.pathname.startsWith('/favicon/')) {
    event.respondWith(
      caches.match(request).then((cached) => {
        if (cached) return cached;
        return fetch(request).then((response) => {
          if (response.ok) {
            const clone = response.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(request, clone));
          }
          return response;
        });
      })
    );
    return;
  }

  // 6. Everything else — pass through to network (no cache)
});

// ─── Push Notification ───
// iOS requires `data`-only payload format (not notification-only).
// Server sends: { data: { type, title, body, tag, url, timestamp } }
// We MUST call showNotification() here for the notification to appear.
self.addEventListener('push', (event) => {
  if (!event.data) return;

  let payload;
  try {
    payload = event.data.json();
  } catch {
    // Plain text fallback
    payload = {
      data: {
        title: 'Smart Door Lock',
        body: event.data.text(),
        type: 'unknown',
      },
    };
  }

  // Extract from data-only payload (iOS-compatible format)
  const notifData = payload.data || payload;
  const title = notifData.title || 'Smart Door Lock';
  const body = notifData.body || '';
  const tag = notifData.tag || 'smart-door-push';
  const type = notifData.type || 'unknown';
  const url = notifData.url || '/';
  const timestamp = notifData.timestamp;

  // Choose vibration pattern based on event type
  const isAlert = type === 'rfid_denied' || type === 'device_offline';

  const options = {
    body,
    icon: '/favicon/android-chrome-192x192.png',
    badge: '/favicon/favicon-32x32.png',
    tag,
    data: { url, type, timestamp },
    vibrate: isAlert ? [200, 100, 200, 100, 200] : [100, 50, 100],
    requireInteraction: isAlert,
    renotify: true,
    silent: false,
  };

  event.waitUntil(
    self.registration.showNotification(title, options)
  );
});

// ─── Notification Click ───
self.addEventListener('notificationclick', (event) => {
  event.notification.close();

  const url = event.notification.data?.url || '/';

  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clients) => {
      // Focus existing window if found
      for (const client of clients) {
        if (client.url.includes(self.location.origin) && 'focus' in client) {
          return client.focus();
        }
      }
      // Open new window
      return self.clients.openWindow(url);
    })
  );
});

// ─── Message from client (e.g., skip waiting for update) ───
self.addEventListener('message', (event) => {
  if (event.data === 'skipWaiting') {
    self.skipWaiting();
  }
});
