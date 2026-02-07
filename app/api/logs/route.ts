import { NextRequest, NextResponse } from 'next/server';
import { addAccessLog, getAccessLogs, getCardByUid, validateApiKey } from '@/lib/db';
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
  return result === 0;
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

// GET /api/logs - Get all access logs
export async function GET() {
  try {
    const logs = await getAccessLogs();

    const mapped = await Promise.all(
      logs.map(async (log) => {
        let cardNickname: string | undefined;

        if (log.accessType === 'WEB') {
          cardNickname = 'Web';
        } else if (log.accessType === 'TOUCH') {
          cardNickname = 'Touch Sensor';
        } else if (log.uid) {
          const card = await getCardByUid(log.uid);
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
      })
    );

    return NextResponse.json(mapped);
  } catch (error: any) {
    console.error('Error fetching logs:', error);
    return NextResponse.json(
      { success: false, message: 'Internal server error', error: error?.message || String(error) },
      { status: 500 }
    );
  }
}
