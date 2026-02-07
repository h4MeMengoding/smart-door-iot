import { NextRequest, NextResponse } from 'next/server';
import { getSystemConfig, setSystemConfig, getCardDelays, upsertCardDelay, deleteCardDelay, validateApiKey } from '@/lib/db';

export const dynamic = 'force-dynamic';

// GET /api/config - Get all system config
export async function GET() {
  try {
    const autoLockStr = await getSystemConfig('auto_lock_duration');
    const autoLockDuration = autoLockStr ? parseInt(autoLockStr) : 5; // default 5s

    const cardDelays = await getCardDelays();
    const mappedDelays = cardDelays.map((d) => ({
      cardUid: d.cardUid,
      delaySec: d.delaySec,
    }));

    return NextResponse.json({
      autoLockDuration,
      cardDelays: mappedDelays,
    });
  } catch (error) {
    console.error('Error fetching config:', error);
    return NextResponse.json(
      { success: false, message: 'Internal server error' },
      { status: 500 }
    );
  }
}

// PUT /api/config - Update system config
export async function PUT(request: NextRequest) {
  try {
    const apiKey = request.headers.get('x-api-key');
    if (!validateApiKey(apiKey)) {
      return NextResponse.json(
        { success: false, message: 'Unauthorized' },
        { status: 401 }
      );
    }

    const body = await request.json();
    const { autoLockDuration, cardDelay } = body;

    // Update auto-lock duration
    if (autoLockDuration !== undefined) {
      const duration = Math.max(1, Math.min(60, parseInt(autoLockDuration)));
      await setSystemConfig('auto_lock_duration', duration.toString());
    }

    // Update card delay
    if (cardDelay) {
      const { cardUid, delaySec } = cardDelay;
      if (cardUid) {
        if (delaySec === 0 || delaySec === undefined) {
          await deleteCardDelay(cardUid);
        } else {
          const delay = Math.max(0, Math.min(30, parseInt(delaySec)));
          await upsertCardDelay(cardUid, delay);
        }
      }
    }

    // Return updated config
    const autoLockStr = await getSystemConfig('auto_lock_duration');
    const currentAutoLock = autoLockStr ? parseInt(autoLockStr) : 5;
    const currentDelays = await getCardDelays();

    return NextResponse.json({
      success: true,
      autoLockDuration: currentAutoLock,
      cardDelays: currentDelays.map((d) => ({
        cardUid: d.cardUid,
        delaySec: d.delaySec,
      })),
    });
  } catch (error) {
    console.error('Error updating config:', error);
    return NextResponse.json(
      { success: false, message: 'Internal server error' },
      { status: 500 }
    );
  }
}
