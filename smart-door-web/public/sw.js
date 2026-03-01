// Smart Door Lock — Service Worker v4
// ====================================
// CACHE POLICY — minimal, safe for Cloudflare Access:
//   - API routes (/api/*) → NEVER intercepted (real-time MQTT data)
//   - Navigation (HTML pages) → NEVER intercepted (fresh React bundles)
//   - Manifest (.webmanifest) → NEVER intercepted (Chrome needs direct access for PWA)
//   - /_next/static/* → Cache-first (content-hashed, immutable per deploy)
//   - Everything else → NEVER intercepted (pass-through)
//
// NO PRE-CACHING — Cloudflare Access/Tunnel can block fetch during SW install.
// GUARANTEE: All data from MQTT and API is always real-time from network.

const CACHE_NAME = 'smart-door-v4';

// ─── Install ───
// No precaching — skip straight to activation.
// Cloudflare Access can block fetch() during install, causing SW to fail.
self.addEventListener('install', () => {
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
// ONLY intercept /_next/static/* (immutable hashed assets).
// Everything else passes through to the network untouched.
self.addEventListener('fetch', (event) => {
  const { request } = event;
  if (request.method !== 'GET') return;

  const url = new URL(request.url);

  // Only cache Next.js immutable static assets (content-hashed filenames).
  // These are safe to cache forever — new deploy = new filename.
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
        }).catch(() => caches.match(request));
      })
    );
    return;
  }

  // Everything else: DO NOT intercept.
  // This ensures manifest, favicon, API, navigation all go directly to network.
  // Critical for Cloudflare Access compatibility.
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
