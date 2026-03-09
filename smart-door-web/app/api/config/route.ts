import { NextRequest, NextResponse } from 'next/server';
import { getSystemConfig, setSystemConfig, getCardDelays, upsertCardDelay, deleteCardDelay, getCardDelaySchedules, upsertCardDelaySchedule, deleteCardDelaySchedule, deleteAllCardDelaySchedules, bulkUpsertCardDelaySchedule, setCardDelayEnabled, bulkSetCardDelayEnabled } from '@/lib/db';

export const dynamic = 'force-dynamic';

// GET /api/config - Get all system config
export async function GET() {
  try {
    // Parallel fetch — all queries run simultaneously
    const [autoLockStr, cardDelays, cardSchedules] = await Promise.all([
      getSystemConfig('auto_lock_duration'),
      getCardDelays(),
      getCardDelaySchedules(),
    ]);

    const autoLockDuration = autoLockStr ? parseInt(autoLockStr) : 5;
    const mappedDelays = cardDelays.map((d) => ({
      cardUid: d.cardUid,
      delaySec: d.delaySec,
      enabled: d.enabled,
    }));
    const mappedSchedules = cardSchedules.map((s) => ({
      cardUid: s.cardUid,
      startHour: s.startHour,
      endHour: s.endHour,
      delaySec: s.delaySec,
    }));

    return NextResponse.json({
      autoLockDuration,
      cardDelays: mappedDelays,
      cardSchedules: mappedSchedules,
    });
  } catch (error) {
    console.error('Error fetching config:', error);
    return NextResponse.json(
      { success: false, message: 'Internal server error' },
      { status: 500 }
    );
  }
}

// PUT /api/config - Update system config (auth handled by Cloudflare Access)
export async function PUT(request: NextRequest) {
  try {
    const body = await request.json();
    const { autoLockDuration, cardDelay, cardSchedule, bulkSchedule, removeSchedule, enableDelay, bulkEnableDelay } = body;

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

    // Add/update card delay schedule
    if (cardSchedule) {
      const { cardUid, startHour, endHour, delaySec } = cardSchedule;
      if (cardUid !== undefined && startHour !== undefined && endHour !== undefined && delaySec !== undefined) {
        await upsertCardDelaySchedule(cardUid, startHour, endHour, delaySec);
      }
    }

    // Bulk schedule (apply same schedule to multiple cards)
    if (bulkSchedule) {
      const { cardUids, startHour, endHour, delaySec } = bulkSchedule;
      if (cardUids?.length && startHour !== undefined && endHour !== undefined && delaySec !== undefined) {
        await bulkUpsertCardDelaySchedule(cardUids, startHour, endHour, delaySec);
      }
    }

    // Remove schedule for a card
    if (removeSchedule) {
      const { cardUid, startHour, endHour, all } = removeSchedule;
      if (all && cardUid) {
        await deleteAllCardDelaySchedules(cardUid);
      } else if (cardUid && startHour !== undefined && endHour !== undefined) {
        await deleteCardDelaySchedule(cardUid, startHour, endHour);
      }
    }

    // Enable/disable delay for a single card
    if (enableDelay) {
      const { cardUid, enabled } = enableDelay;
      if (cardUid !== undefined && enabled !== undefined) {
        await setCardDelayEnabled(cardUid, enabled);
      }
    }

    // Bulk enable/disable delay
    if (bulkEnableDelay) {
      const { cardUids, enabled } = bulkEnableDelay;
      if (cardUids?.length && enabled !== undefined) {
        await bulkSetCardDelayEnabled(cardUids, enabled);
      }
    }

    // Return updated config — parallel fetch
    const [updatedAutoLockStr, currentDelays, currentSchedules] = await Promise.all([
      getSystemConfig('auto_lock_duration'),
      getCardDelays(),
      getCardDelaySchedules(),
    ]);
    const currentAutoLock = updatedAutoLockStr ? parseInt(updatedAutoLockStr) : 5;

    return NextResponse.json({
      success: true,
      autoLockDuration: currentAutoLock,
      cardDelays: currentDelays.map((d) => ({
        cardUid: d.cardUid,
        delaySec: d.delaySec,
        enabled: d.enabled,
      })),
      cardSchedules: currentSchedules.map((s) => ({
        cardUid: s.cardUid,
        startHour: s.startHour,
        endHour: s.endHour,
        delaySec: s.delaySec,
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
