import { NextRequest, NextResponse } from 'next/server';
import { addAccessLog, getCardByUid, validateApiKey, addSystemEvent } from '@/lib/db';
import { prisma } from '@/lib/prisma';
import { logEvents } from '@/lib/events';
import { verifySessionCookie } from '@/lib/auth';

export const dynamic = 'force-dynamic';

// POST /api/logs - Add new access log (from ESP32 via API key, or dashboard via session)
export async function POST(request: NextRequest) {
  try {
    const apiKey = request.headers.get('x-api-key');
    const hasApiKey = validateApiKey(apiKey);
    const sessionCookie = request.cookies.get('smart-door-session');
    const hasSession = sessionCookie?.value ? await verifySessionCookie(sessionCookie.value) : false;

    if (!hasApiKey && !hasSession) {
      return NextResponse.json(
        { success: false, message: 'Unauthorized' },
        { status: 401 }
      );
    }

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
      orderBy: { createdAt: 'desc' },
    });

    if (duplicate) {
      return NextResponse.json({ success: true, log: { id: duplicate.id, deduplicated: true } });
    }

    const log = await addAccessLog({
      uid,
      accessType,
      accessResult,
    });

    // Get card info for nickname (only for RFID with valid uid)
    let cardNickname: string | undefined;
    let displayName: string;

    if (accessType === 'WEB') {
      displayName = 'Web';
    } else if (accessType === 'TOUCH') {
      displayName = 'Touch Sensor';
    } else if (uid) {
      const card = await getCardByUid(uid);
      cardNickname = card?.isNamed ? card.displayName : undefined;
      displayName = cardNickname || uid;
    } else {
      displayName = 'Unknown';
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

    // Auto-create system event from access log
    try {
      const evtType = accessResult === 'granted' ? 'access_granted' : 'access_denied';
      const evtDesc = `${accessType} ${accessResult}: ${displayName}`;
      await addSystemEvent(evtType, evtDesc);
    } catch { /* non-critical */ }

    return NextResponse.json({ success: true, log: mappedLog });
  } catch (error) {
    console.error('Error adding log:', error);
    return NextResponse.json(
      { success: false, message: 'Internal server error' },
      { status: 500 }
    );
  }
}

// GET /api/logs - Get access logs (supports ?since=ISO for incremental polling)
export async function GET(request: NextRequest) {
  try {
    const since = request.nextUrl.searchParams.get('since');

    // Build query — if 'since' provided, only return logs newer than that timestamp
    const whereClause = since
      ? { createdAt: { gt: new Date(since) } }
      : undefined;

    const logs = await prisma.accessLog.findMany({
      where: whereClause,
      orderBy: { createdAt: 'desc' },
      take: since ? 50 : 200, // Smaller batch for incremental polls
    });

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

    return NextResponse.json(mapped);
  } catch (error) {
    console.error('Error fetching logs:', error);
    return NextResponse.json(
      { success: false, message: 'Internal server error' },
      { status: 500 }
    );
  }
}
