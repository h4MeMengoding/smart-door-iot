import webpush from 'web-push';
import { prisma } from './prisma';

// VAPID configuration
// VAPID (Voluntary Application Server Identification) is a W3C Web Push standard.
// The subject MUST be a mailto: or https:// URL — it identifies your server to
// push services (Google FCM, Apple APNs). It is NOT used to send any email.
const VAPID_PUBLIC_KEY = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY || '';
const VAPID_PRIVATE_KEY = process.env.VAPID_PRIVATE_KEY || '';
const VAPID_SUBJECT = process.env.VAPID_SUBJECT || 'https://smartdoor.local';

if (VAPID_PUBLIC_KEY && VAPID_PRIVATE_KEY) {
  webpush.setVapidDetails(VAPID_SUBJECT, VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY);
}

export { VAPID_PUBLIC_KEY };

export interface PushPayload {
  type: string;
  title: string;
  body: string;
  tag?: string;
  url?: string;
  timestamp?: string;
}

// ─── iOS APNs Topic Mapping ───
// APNs topic MUST be ≤32 chars and consistent per notification type.
// Using a fixed topic per type enables proper coalescing on iOS.
const TOPIC_MAP: Record<string, string> = {
  door_open: 'smart-door-open',
  door_locked: 'smart-door-locked',
  rfid_access: 'smart-door-rfid',
  rfid_denied: 'smart-door-denied',
  rfid_disabled: 'smart-door-rfid-toggle',
  card_registered: 'smart-door-card-add',
  card_removed: 'smart-door-card-rm',
  device_offline: 'smart-door-offline',
  device_online: 'smart-door-online',
};

// TTL per notification type — real-time events expire faster
const TTL_MAP: Record<string, number> = {
  door_open: 120,       // 2 min — stale door open is useless
  door_locked: 120,     // 2 min
  rfid_access: 300,     // 5 min
  rfid_denied: 600,     // 10 min — security alert, longer TTL
  device_offline: 1800, // 30 min
  device_online: 300,   // 5 min
};

const DEFAULT_TTL = 300; // 5 min

/**
 * Send a single push with retry (for transient 429/5xx failures).
 * Returns true if delivered, false if permanently failed.
 */
async function sendWithRetry(
  sub: { endpoint: string; p256dh: string; auth: string },
  payload: string,
  options: webpush.RequestOptions,
  maxRetries = 2,
): Promise<{ ok: boolean; expired: boolean }> {
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      await webpush.sendNotification(
        { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
        payload,
        options,
      );
      return { ok: true, expired: false };
    } catch (err: unknown) {
      const statusCode = (err as { statusCode?: number })?.statusCode;

      // 404/410 = subscription expired/invalid — don't retry
      if (statusCode === 404 || statusCode === 410) {
        return { ok: false, expired: true };
      }

      // 429 (rate limited) or 5xx (server error) — retry with backoff
      if ((statusCode === 429 || (statusCode && statusCode >= 500)) && attempt < maxRetries) {
        const delay = Math.min(1000 * Math.pow(2, attempt), 4000); // 1s, 2s, 4s
        await new Promise(r => setTimeout(r, delay));
        continue;
      }

      // Other error (400, 403, etc.) — don't retry
      return { ok: false, expired: false };
    }
  }
  return { ok: false, expired: false };
}

/**
 * Send push notification to ALL subscribed clients.
 * Uses `data`-only payload (not notification-only) for iOS compatibility.
 * The service worker is responsible for calling showNotification().
 *
 * iOS reliability features:
 *  - Per-type TTL (stale events expire quickly)
 *  - Fixed APNs topic per type (proper coalescing)
 *  - Urgency: high (iOS delivers immediately)
 *  - Retry with exponential backoff on transient failures
 *  - Auto-cleanup of expired subscriptions
 */
export async function sendPushToAll(payload: PushPayload): Promise<{ sent: number; failed: number }> {
  if (!VAPID_PUBLIC_KEY || !VAPID_PRIVATE_KEY) {
    return { sent: 0, failed: 0 };
  }

  const subscriptions = await prisma.pushSubscription.findMany();
  if (subscriptions.length === 0) return { sent: 0, failed: 0 };

  // Build data-only payload (critical for iOS background delivery)
  const pushPayload = JSON.stringify({
    data: {
      type: payload.type,
      title: payload.title,
      body: payload.body,
      tag: payload.tag || `smart-door-${payload.type}`,
      url: payload.url || '/',
      timestamp: payload.timestamp || new Date().toISOString(),
    },
  });

  const ttl = TTL_MAP[payload.type] ?? DEFAULT_TTL;
  const topic = TOPIC_MAP[payload.type] || 'smart-door-notification';

  const pushOptions: webpush.RequestOptions = {
    TTL: ttl,
    urgency: 'high',
    // APNs topic — must be ≤32 chars, consistent per notification type
    topic,
  };

  let sent = 0;
  let failed = 0;
  const expiredEndpoints: string[] = [];

  await Promise.allSettled(
    subscriptions.map(async (sub) => {
      const result = await sendWithRetry(sub, pushPayload, pushOptions);
      if (result.ok) {
        sent++;
      } else {
        failed++;
        if (result.expired) {
          expiredEndpoints.push(sub.endpoint);
        }
      }
    })
  );

  // Clean up expired subscriptions
  if (expiredEndpoints.length > 0) {
    await prisma.pushSubscription.deleteMany({
      where: { endpoint: { in: expiredEndpoints } },
    }).catch(() => {});
  }

  return { sent, failed };
}
