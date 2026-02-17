import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { isMasterCardUid } from '@/lib/utils';
import { addSystemEvent } from '@/lib/db';

export const dynamic = 'force-dynamic';

/**
 * POST /api/cards/sync-db
 * Background DB sync - receives the full card list from ESP32 (via WebSocket)
 * and syncs it to the database. This runs AFTER the UI has already updated.
 * 
 * Body: { cards: string[] } - Array of card UIDs currently on ESP32
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { cards: espCards } = body as { cards: string[] };

    if (!Array.isArray(espCards)) {
      return NextResponse.json(
        { success: false, message: 'cards must be an array of UIDs' },
        { status: 400 }
      );
    }

    // Filter out master cards
    const validCards = espCards.filter((uid) => uid && !isMasterCardUid(uid));

    // Get current DB cards
    const dbCards = await prisma.accessCredential.findMany({
      where: { uid: { not: null } },
      select: { uid: true, displayName: true, isNamed: true },
    });

    const dbUids = new Set(dbCards.map((c) => c.uid!.toUpperCase()));
    const espUids = new Set(validCards.map((uid) => uid.toUpperCase()));

    // Cards to add to DB (in ESP but not in DB)
    const toAdd = validCards.filter((uid) => !dbUids.has(uid.toUpperCase()));

    // Cards to remove from DB (in DB but not in ESP) — only unnamed ones
    const toRemove = dbCards.filter(
      (c) => c.uid && !espUids.has(c.uid.toUpperCase()) && !isMasterCardUid(c.uid)
    );

    // Perform upserts for new cards — BATCHED in a single transaction
    if (toAdd.length > 0) {
      await prisma.$transaction(
        toAdd.map((uid) =>
          prisma.accessCredential.upsert({
            where: { uid: uid.toUpperCase() },
            update: {},
            create: {
              uid: uid.toUpperCase(),
              displayName: 'Unknown User',
              isNamed: false,
            },
          })
        )
      );
    }

    // Remove cards no longer on ESP — BATCHED
    if (toRemove.length > 0) {
      const removeUids = toRemove.map((c) => c.uid!);
      await prisma.$transaction([
        prisma.cardDelayConfig.deleteMany({
          where: { cardUid: { in: removeUids } },
        }),
        prisma.accessCredential.deleteMany({
          where: { uid: { in: removeUids } },
        }),
      ]);
    }

    // Log sync events
    try {
      if (toAdd.length > 0 || toRemove.length > 0) {
        await addSystemEvent('card_sync', `Card sync: +${toAdd.length} added, -${toRemove.length} removed`);
      }
    } catch { /* non-critical */ }

    return NextResponse.json({
      success: true,
      added: toAdd.length,
      removed: toRemove.length,
      total: validCards.length,
    });
  } catch (error) {
    console.error('DB sync error:', error);
    return NextResponse.json(
      { success: false, message: 'Internal server error' },
      { status: 500 }
    );
  }
}
