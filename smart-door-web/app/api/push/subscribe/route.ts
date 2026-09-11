import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { VAPID_PUBLIC_KEY } from '@/lib/webpush';
import { requireApiAccess } from '@/lib/apiAuth';

export const dynamic = 'force-dynamic';

// POST /api/push/subscribe — register a push subscription
export async function POST(request: NextRequest) {
  const denied = await requireApiAccess(request);
  if (denied) return denied;
  try {
    const body = await request.json();
    const { subscription, userAgent } = body;

    if (!subscription?.endpoint || !subscription?.keys?.p256dh || !subscription?.keys?.auth) {
      return NextResponse.json(
        { success: false, message: 'Invalid subscription object' },
        { status: 400 }
      );
    }

    // Upsert — update keys if endpoint already exists
    await prisma.pushSubscription.upsert({
      where: { endpoint: subscription.endpoint },
      create: {
        endpoint: subscription.endpoint,
        p256dh: subscription.keys.p256dh,
        auth: subscription.keys.auth,
        userAgent: userAgent || null,
      },
      update: {
        p256dh: subscription.keys.p256dh,
        auth: subscription.keys.auth,
        userAgent: userAgent || null,
      },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Push subscribe error:', error);
    return NextResponse.json(
      { success: false, message: 'Internal server error' },
      { status: 500 }
    );
  }
}

// DELETE /api/push/subscribe — unsubscribe
export async function DELETE(request: NextRequest) {
  const denied = await requireApiAccess(request);
  if (denied) return denied;
  try {
    const body = await request.json();
    const { endpoint } = body;

    if (!endpoint) {
      return NextResponse.json(
        { success: false, message: 'Missing endpoint' },
        { status: 400 }
      );
    }

    await prisma.pushSubscription.deleteMany({
      where: { endpoint },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Push unsubscribe error:', error);
    return NextResponse.json(
      { success: false, message: 'Internal server error' },
      { status: 500 }
    );
  }
}

// GET /api/push/subscribe — return VAPID public key
export async function GET() {
  return NextResponse.json({
    publicKey: VAPID_PUBLIC_KEY,
    configured: !!VAPID_PUBLIC_KEY,
  });
}
