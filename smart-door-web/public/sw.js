// Smart Door Lock — Service Worker v5
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

const CACHE_NAME = 'smart-door-v5';

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
  // CRITICAL: Always call event.waitUntil() even if no data.
  // On iOS, failing to show a notification may revoke push permission.
  if (!event.data) {
    event.waitUntil(
      self.registration.showNotification('Smart Door Lock', {
        body: 'New event',
        icon: '/favicon/android-chrome-192x192.png',
        badge: '/favicon/favicon-32x32.png',
        tag: 'smart-door-fallback',
      })
    );
    return;
  }

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
    // iOS shows timestamp in notification shade
    timestamp: timestamp ? new Date(timestamp).getTime() : Date.now(),
  };

  event.waitUntil(
    self.registration.showNotification(title, options)
  );
});

// ─── Push Subscription Change (iOS endpoint rotation) ───
// When iOS APNs rotates the push endpoint, re-subscribe and sync to server.
self.addEventListener('pushsubscriptionchange', (event) => {
  event.waitUntil(
    (async () => {
      try {
        // Delete old subscription from server if available
        if (event.oldSubscription) {
          await fetch('/api/push/subscribe', {
            method: 'DELETE',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ endpoint: event.oldSubscription.endpoint }),
          }).catch(() => {});
        }

        // Get VAPID public key
        const keyRes = await fetch('/api/push/subscribe');
        if (!keyRes.ok) return;
        const { publicKey } = await keyRes.json();
        if (!publicKey) return;

        // Re-subscribe with new endpoint
        const applicationServerKey = urlBase64ToUint8Array(publicKey);
        const newSub = await self.registration.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: applicationServerKey.buffer,
        });

        // Sync new subscription to server
        const subJson = newSub.toJSON();
        await fetch('/api/push/subscribe', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            subscription: {
              endpoint: subJson.endpoint,
              keys: subJson.keys,
            },
            userAgent: 'SW-pushsubscriptionchange',
          }),
        });
        console.log('[SW] Push subscription rotated and re-synced');
      } catch (err) {
        console.error('[SW] pushsubscriptionchange failed:', err);
      }
    })()
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

// ─── Utility: Base64URL → Uint8Array (for VAPID key in SW context) ───
function urlBase64ToUint8Array(base64String) {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const rawData = atob(base64);
  const outputArray = new Uint8Array(rawData.length);
  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
}
