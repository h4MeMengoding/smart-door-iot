// Push Notification Types
export type NotificationType =
  | 'door_open'
  | 'door_locked'
  | 'rfid_access'
  | 'rfid_denied'
  | 'rfid_disabled'
  | 'card_registered'
  | 'card_removed'
  | 'device_offline'
  | 'device_online';

export interface NotificationPreferences {
  door_open: boolean;
  door_locked: boolean;
  rfid_access: boolean;
  rfid_denied: boolean;
  rfid_disabled: boolean;
  card_registered: boolean;
  card_removed: boolean;
  device_offline: boolean;
  device_online: boolean;
}

const DEFAULT_PREFERENCES: NotificationPreferences = {
  door_open: true,
  door_locked: false,
  rfid_access: true,
  rfid_denied: true,
  rfid_disabled: true,
  card_registered: true,
  card_removed: true,
  device_offline: true,
  device_online: true,
};

const PREFS_KEY = 'push_notification_prefs';

export function getNotificationPreferences(): NotificationPreferences {
  if (typeof window === 'undefined') return DEFAULT_PREFERENCES;
  try {
    const stored = localStorage.getItem(PREFS_KEY);
    if (stored) {
      return { ...DEFAULT_PREFERENCES, ...JSON.parse(stored) };
    }
  } catch { /* ignore */ }
  return { ...DEFAULT_PREFERENCES };
}

export function setNotificationPreferences(prefs: NotificationPreferences): void {
  if (typeof window === 'undefined') return;
  localStorage.setItem(PREFS_KEY, JSON.stringify(prefs));
}

export function isNotificationSupported(): boolean {
  return typeof window !== 'undefined' && 'Notification' in window && 'serviceWorker' in navigator;
}

export function getNotificationPermission(): NotificationPermission | 'unsupported' {
  if (!isNotificationSupported()) return 'unsupported';
  return Notification.permission;
}

export async function requestNotificationPermission(): Promise<NotificationPermission> {
  if (!isNotificationSupported()) return 'denied';
  return Notification.permission === 'granted'
    ? 'granted'
    : await Notification.requestPermission();
}

/**
 * Subscribe to server-side Web Push notifications.
 * Called after the user grants notification permission.
 * This enables push notifications even when the PWA is closed (critical for iOS).
 */
export async function subscribeToPush(): Promise<boolean> {
  try {
    if (!('serviceWorker' in navigator) || !('PushManager' in window)) return false;

    // Get VAPID public key from server
    const res = await fetch('/api/push/subscribe');
    const { publicKey, configured } = await res.json();
    if (!configured || !publicKey) return false;

    const registration = await navigator.serviceWorker.ready;

    // Check if already subscribed
    let subscription = await registration.pushManager.getSubscription();

    if (!subscription) {
      // Convert VAPID key to Uint8Array
      const applicationServerKey = urlBase64ToUint8Array(publicKey);
      subscription = await registration.pushManager.subscribe({
        userVisibleNotificationsOnly: true,
        applicationServerKey: applicationServerKey.buffer as ArrayBuffer,
      } as PushSubscriptionOptionsInit);
    }

    // Send subscription to server
    const subJson = subscription.toJSON();
    await fetch('/api/push/subscribe', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        subscription: {
          endpoint: subJson.endpoint,
          keys: subJson.keys,
        },
        userAgent: navigator.userAgent,
      }),
    });

    return true;
  } catch (err) {
    console.error('Push subscription failed:', err);
    return false;
  }
}

/**
 * Unsubscribe from server-side Web Push notifications.
 */
export async function unsubscribeFromPush(): Promise<void> {
  try {
    const registration = await navigator.serviceWorker.ready;
    const subscription = await registration.pushManager.getSubscription();
    if (subscription) {
      const endpoint = subscription.endpoint;
      await subscription.unsubscribe();
      await fetch('/api/push/subscribe', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ endpoint }),
      }).catch(() => {});
    }
  } catch {
    // Silent fail
  }
}

/**
 * Check if push subscription is active
 */
export async function isPushSubscribed(): Promise<boolean> {
  try {
    if (!('serviceWorker' in navigator) || !('PushManager' in window)) return false;
    const registration = await navigator.serviceWorker.ready;
    const subscription = await registration.pushManager.getSubscription();
    return !!subscription;
  } catch {
    return false;
  }
}

export async function sendLocalNotification(
  type: NotificationType,
  title: string,
  body: string,
  tag?: string
): Promise<void> {
  const prefs = getNotificationPreferences();

  // Check if this notification type is enabled
  if (!prefs[type]) return;

  // Check permission
  if (Notification.permission !== 'granted') return;

  // Get service worker registration
  try {
    const registration = await navigator.serviceWorker.ready;
    await registration.showNotification(title, {
      body,
      icon: '/favicon/android-chrome-192x192.png',
      badge: '/favicon/favicon-32x32.png',
      tag: tag || `smart-door-${type}-${Date.now()}`,
      renotify: true,
    } as NotificationOptions);
  } catch {
    // Fallback to regular Notification API
    try {
      new Notification(title, {
        body,
        icon: '/favicon/android-chrome-192x192.png',
        tag: tag || `smart-door-${type}`,
      });
    } catch {
      // Silent fail
    }
  }
}

// Check if app is installed as PWA
export function isPWAInstalled(): boolean {
  if (typeof window === 'undefined') return false;
  // Check display-mode: standalone
  if (window.matchMedia('(display-mode: standalone)').matches) return true;
  // iOS Safari standalone
  if ((navigator as unknown as { standalone?: boolean }).standalone === true) return true;
  return false;
}

// Check if app can be installed (beforeinstallprompt fired)
export function isInstallable(): boolean {
  return typeof window !== 'undefined' && !!(window as unknown as { __pwaInstallPrompt?: unknown }).__pwaInstallPrompt;
}

// Detect iOS
export function isIOS(): boolean {
  if (typeof window === 'undefined') return false;
  return /iPad|iPhone|iPod/.test(navigator.userAgent) ||
    (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
}

// Detect Android
export function isAndroid(): boolean {
  if (typeof window === 'undefined') return false;
  return /Android/.test(navigator.userAgent);
}

// ── Utility ──

function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const rawData = atob(base64);
  const outputArray = new Uint8Array(rawData.length);
  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
}
