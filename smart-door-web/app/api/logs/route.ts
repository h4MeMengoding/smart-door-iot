import { NextRequest, NextResponse } from 'next/server';
import { addAccessLog, getCardByUid, validateApiKey } from '@/lib/db';
import { prisma } from '@/lib/prisma';
import { logEvents } from '@/lib/events';

export const dynamic = 'force-dynamic';

// Helper: verify session cookie (for dashboard calls)
async function hasValidSession(request: NextRequest): Promise<boolean> {
  const cookie = request.cookies.get('smart-door-session');
  if (!cookie?.value) return false;
  const parts = cookie.value.split('.');
  if (parts.length !== 2) return false;
  const [token, signature] = parts;
  const secret = process.env.AUTH_SESSION_SECRET || 'default-secret';
  const encoder = new TextEncoder();
  const key = await crypto.subtle.importKey(
    'raw', encoder.encode(secret),
    { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']
  );
  const sig = await crypto.subtle.sign('HMAC', key, encoder.encode(token));
  const expected = Array.from(new Uint8Array(sig)).map(b => b.toString(16).padStart(2, '0')).join('');
  if (signature.length !== expected.length) return false;
  let result = 0;
  for (let i = 0; i < signature.length; i++) {
    result |= signature.charCodeAt(i) ^ expected.charCodeAt(i);
  }
  if (result !== 0) return false;

  // Check expiry from embedded timestamp
  const colonIdx = token.lastIndexOf(':');
  if (colonIdx === -1) return false;
  const createdAt = parseInt(token.substring(colonIdx + 1), 10);
  if (isNaN(createdAt)) return false;
  const SESSION_DURATION = 30 * 24 * 60 * 60 * 1000;
  if (Date.now() - createdAt > SESSION_DURATION) return false;

  return true;
}

// POST /api/logs - Add new access log (from ESP32 via API key, or dashboard via session)
export async function POST(request: NextRequest) {
  try {
    const apiKey = request.headers.get('x-api-key');
    const hasApiKey = validateApiKey(apiKey);
    const hasSession = await hasValidSession(request);

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
