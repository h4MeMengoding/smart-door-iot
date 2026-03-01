// Smart Door Lock — Service Worker with Push Notifications
const CACHE_NAME = 'smart-door-v1';

// Install event
self.addEventListener('install', () => {
  self.skipWaiting();
});

// Activate event
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k)))
    ).then(() => self.clients.claim())
  );
});

// Push notification event
self.addEventListener('push', (event) => {
  if (!event.data) return;

  let payload;
  try {
    payload = event.data.json();
  } catch {
    payload = {
      title: 'Smart Door Lock',
      body: event.data.text(),
      icon: '/favicon/android-chrome-192x192.png',
    };
  }

  const { title, body, icon, badge, tag, data, actions } = payload;

  const options = {
    body: body || '',
    icon: icon || '/favicon/android-chrome-192x192.png',
    badge: badge || '/favicon/favicon-32x32.png',
    tag: tag || 'smart-door-notification',
    data: data || {},
    actions: actions || [],
    vibrate: [100, 50, 100],
    requireInteraction: false,
  };

  event.waitUntil(
    self.registration.showNotification(title || 'Smart Door Lock', options)
  );
});

// Notification click event
self.addEventListener('notificationclick', (event) => {
  event.notification.close();

  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clients) => {
      // Focus existing window or open new one
      for (const client of clients) {
        if (client.url.includes(self.location.origin) && 'focus' in client) {
          return client.focus();
        }
      }
      return self.clients.openWindow('/');
    })
  );
});
