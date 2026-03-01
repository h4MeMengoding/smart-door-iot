import { NextRequest, NextResponse } from 'next/server';
import { addAccessLog, getCardByUid, addSystemEvent } from '@/lib/db';
import { prisma } from '@/lib/prisma';
import { logEvents } from '@/lib/events';

export const dynamic = 'force-dynamic';

// POST /api/logs - Add new access log (no auth — Cloudflare Access protects the domain)
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { cardUid, action, success, accessType: clientAccessType } = body;

    if (!action || typeof success !== 'boolean') {
      return NextResponse.json(
        { success: false, message: 'Missing required fields' },
        { status: 400 }
      );
    }

    // Determine access type and uid
    const accessType = clientAccessType || 'RFID';
    const accessResult = success ? 'granted' : 'denied';

    // For WEB/TOUCH: uid is null
    const uid = (accessType === 'WEB' || accessType === 'TOUCH') ? null : (cardUid || null);

    // Deduplication: skip if an identical log exists within the last 10 seconds
    // (prevents double entries from server-side MQTT + browser POST)
    const recentCutoff = new Date(Date.now() - 10_000);
    const duplicate = await prisma.accessLog.findFirst({
      where: {
        uid: uid,
        accessType,
        accessResult,
        createdAt: { gt: recentCutoff },
      },
      select: { id: true },
    });

    if (duplicate) {
      return NextResponse.json({ success: true, log: { id: duplicate.id, deduplicated: true } });
    }

    // Combined: upsert card + create log in parallel where possible
    let cardNickname: string | undefined;
    let displayName: string;

    if (accessType === 'WEB') {
      displayName = 'Web';
    } else if (accessType === 'TOUCH') {
      displayName = 'Touch Sensor';
    } else {
      displayName = uid || 'Unknown';
    }

    // For RFID: upsert card first (needed by addAccessLog), then create log
    const log = await addAccessLog({ uid, accessType, accessResult });

    // Fetch card nickname only for RFID with uid — reuse from the upsert if possible
    if (uid && accessType === 'RFID') {
      const card = await getCardByUid(uid);
      if (card?.isNamed) {
        cardNickname = card.displayName;
        displayName = card.displayName;
      }
    }

    const mappedLog = {
      id: log.id,
      timestamp: log.createdAt.toISOString(),
      cardUid: uid,
      cardNickname: cardNickname || (accessType !== 'RFID' ? displayName : undefined),
      action,
      success,
      accessType,
    };

    // Emit ke semua SSE clients
    logEvents.emit(mappedLog);

    // Auto-create system event — fire-and-forget (non-blocking)
    const evtType = accessResult === 'granted' ? 'access_granted' : 'access_denied';
    const evtDesc = `${accessType} ${accessResult}: ${displayName}`;
    addSystemEvent(evtType, evtDesc).catch(() => {});

    return NextResponse.json({ success: true, log: mappedLog });
  } catch (error) {
    console.error('Error adding log:', error);
    return NextResponse.json(
      { success: false, message: 'Internal server error' },
      { status: 500 }
    );
  }
}

// GET /api/logs - Get access logs (supports ?since=ISO for incremental polling, ?limit=N&offset=N for paging)
export async function GET(request: NextRequest) {
  try {
    const since = request.nextUrl.searchParams.get('since');
    const limitParam = request.nextUrl.searchParams.get('limit');
    const offsetParam = request.nextUrl.searchParams.get('offset');

    // Build query — if 'since' provided, only return logs newer than that timestamp
    const whereClause = since
      ? { createdAt: { gt: new Date(since) } }
      : undefined;

    const limit = since ? 50 : (limitParam ? Math.min(parseInt(limitParam, 10), 500) : 200);
    const offset = offsetParam ? parseInt(offsetParam, 10) : 0;

    const [logs, totalCount] = await Promise.all([
      prisma.accessLog.findMany({
        where: whereClause,
        orderBy: { createdAt: 'desc' },
        take: limit,
        skip: offset,
      }),
      prisma.accessLog.count({ where: whereClause }),
    ]);

    // Batch-fetch all card nicknames in ONE query (fix N+1)
    const rfidUids = [...new Set(
      logs.filter(l => l.uid && l.accessType === 'RFID').map(l => l.uid!)
    )];

    const cards = rfidUids.length > 0
      ? await prisma.accessCredential.findMany({
          where: { uid: { in: rfidUids } },
          select: { uid: true, displayName: true, isNamed: true },
        })
      : [];

    const cardMap = new Map(cards.map(c => [c.uid!, c]));

    const mapped = logs.map((log) => {
      let cardNickname: string | undefined;

      if (log.accessType === 'WEB') {
        cardNickname = 'Web';
      } else if (log.accessType === 'TOUCH') {
        cardNickname = 'Touch Sensor';
      } else if (log.uid) {
        const card = cardMap.get(log.uid);
        cardNickname = card?.isNamed ? card.displayName : undefined;
      }

      return {
        id: log.id,
        timestamp: log.createdAt.toISOString(),
        cardUid: log.uid,
        cardNickname,
        action: log.accessResult === 'granted' ? 'unlock' : 'denied',
        success: log.accessResult === 'granted',
        accessType: log.accessType,
      };
    });

    // For incremental polls (since=), return flat array for backward compat
    if (since) {
      return NextResponse.json(mapped);
    }

    // For initial/paginated loads, return with total count
    return NextResponse.json({ logs: mapped, totalCount });
  } catch (error) {
    console.error('Error fetching logs:', error);
    return NextResponse.json(
      { success: false, message: 'Internal server error' },
      { status: 500 }
    );
  }
}
