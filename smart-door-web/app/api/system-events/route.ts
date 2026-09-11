import { NextResponse } from 'next/server';
import { getSystemEvents, addSystemEvent } from '@/lib/db';
import { prisma } from '@/lib/prisma';
import { NextRequest } from 'next/server';
import { requireApiAccess } from '@/lib/apiAuth';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  const denied = await requireApiAccess(request);
  if (denied) return denied;
  try {
    // Cleanup events older than 3 days
    const threeDaysAgo = new Date(Date.now() - 3 * 24 * 60 * 60 * 1000);
    await prisma.systemEvent.deleteMany({ where: { createdAt: { lt: threeDaysAgo } } }).catch(() => {});

    // If no system events exist, seed from recent access logs
    const count = await prisma.systemEvent.count();
    if (count === 0) {
      const recentLogs = await prisma.accessLog.findMany({
        where: { createdAt: { gte: threeDaysAgo } },
        orderBy: { createdAt: 'desc' },
        take: 100,
      });
      if (recentLogs.length > 0) {
        // Batch insert access log events older -> newer so newest is last
        const sorted = recentLogs.reverse();
        const seedData = sorted.map((log) => ({
          eventType: log.accessResult === 'granted' ? 'access_granted' : 'access_denied',
          description: `${log.accessType} ${log.accessResult}: ${log.uid || log.accessType}`,
          createdAt: log.createdAt,
        }));
        await prisma.systemEvent.createMany({ data: seedData }).catch(() => {});
      }
    }

    const events = await getSystemEvents(100);
    return NextResponse.json(events);
  } catch (error) {
    console.error('Failed to fetch system events:', error);
    return NextResponse.json(
      { success: false, message: 'Failed to fetch events' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  const denied = await requireApiAccess(request);
  if (denied) return denied;
  try {
    const body = await request.json();
    const { eventType, description } = body;

    if (!eventType) {
      return NextResponse.json(
        { success: false, message: 'eventType is required' },
        { status: 400 }
      );
    }

    const event = await addSystemEvent(eventType, description || null);
    return NextResponse.json({ success: true, event });
  } catch (error) {
    console.error('Failed to create system event:', error);
    return NextResponse.json(
      { success: false, message: 'Failed to create event' },
      { status: 500 }
    );
  }
}
