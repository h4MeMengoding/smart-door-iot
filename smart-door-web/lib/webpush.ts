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

/**
 * Send push notification to ALL subscribed clients.
 * Uses `data`-only payload (not notification-only) for iOS compatibility.
 * The service worker is responsible for calling showNotification().
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

  let sent = 0;
  let failed = 0;
  const expiredEndpoints: string[] = [];

  await Promise.allSettled(
    subscriptions.map(async (sub) => {
      try {
        await webpush.sendNotification(
          {
            endpoint: sub.endpoint,
            keys: { p256dh: sub.p256dh, auth: sub.auth },
          },
          pushPayload,
          {
            TTL: 60 * 60,
            urgency: 'high',
            // Topic helps iOS APNs coalesce/replace notifications and
            // improves background delivery reliability
            topic: payload.tag || 'smart-door-notification',
          }
        );
        sent++;
      } catch (err: unknown) {
        failed++;
        const statusCode = (err as { statusCode?: number })?.statusCode;
        // 404 or 410 = subscription expired/invalid — remove it
        if (statusCode === 404 || statusCode === 410) {
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
