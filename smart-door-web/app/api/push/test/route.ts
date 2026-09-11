import { NextRequest, NextResponse } from 'next/server';
import { sendPushToAll } from '@/lib/webpush';
import { prisma } from '@/lib/prisma';
import { requireApiAccess } from '@/lib/apiAuth';

export const dynamic = 'force-dynamic';

// POST /api/push/test — send test push notification to all subscribers
export async function POST(request: NextRequest) {
  const denied = await requireApiAccess(request);
  if (denied) return denied;
  try {
    const count = await prisma.pushSubscription.count();
    
    if (count === 0) {
      return NextResponse.json({
        success: false,
        message: 'No push subscriptions found in database',
        subscriptionCount: 0,
      });
    }

    const result = await sendPushToAll({
      type: 'door_open',
      title: '🔔 Test Notification',
      body: 'Push notification is working! This is a test.',
      tag: `test-push-${Date.now()}`,
    });

    return NextResponse.json({
      success: true,
      subscriptionCount: count,
      sent: result.sent,
      failed: result.failed,
    });
  } catch (error) {
    console.error('Test push error:', error);
    return NextResponse.json(
      { success: false, message: String(error) },
      { status: 500 }
    );
  }
}

// GET /api/push/test — show push subscription count for debugging
export async function GET(request: NextRequest) {
  const denied = await requireApiAccess(request);
  if (denied) return denied;
  try {
    const subscriptions = await prisma.pushSubscription.findMany({
      select: { id: true, endpoint: true, userAgent: true, createdAt: true },
    });
    
    return NextResponse.json({
      count: subscriptions.length,
      subscriptions: subscriptions.map((s) => ({
        id: s.id,
        endpoint: s.endpoint.slice(0, 80) + '...',
        userAgent: s.userAgent?.slice(0, 60),
        createdAt: s.createdAt.toISOString(),
      })),
    });
  } catch (error) {
    console.error('Push test GET error:', error);
    return NextResponse.json({ error: String(error) }, { status: 500 });
  }
}
