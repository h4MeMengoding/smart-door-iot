import { NextRequest, NextResponse } from 'next/server';
import { getCards, addCard, removeCard, updateCardName, addSystemEvent } from '@/lib/db';
import { isMasterCardUid } from '@/lib/utils';

export const dynamic = 'force-dynamic';

// GET /api/cards - Get all cards
export async function GET() {
  try {
    const cards = await getCards();

    // Map ke format yang frontend expect
    const mapped = cards
      .filter((c) => !c.uid || !isMasterCardUid(c.uid))
      .map((c) => ({
        uid: c.uid,
        nickname: c.displayName === 'Unknown User' && !c.isNamed ? undefined : c.displayName,
        addedAt: c.createdAt.toISOString(),
        isNamed: c.isNamed,
      }));

    return NextResponse.json(mapped);
  } catch (error) {
    console.error('Error fetching cards:', error);
    return NextResponse.json(
      { success: false, message: 'Internal server error' },
      { status: 500 }
    );
  }
}

// POST /api/cards - Add new card (protected by middleware session check)
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { uid, nickname } = body;

    if (!uid) {
      return NextResponse.json(
        { success: false, message: 'Card UID is required' },
        { status: 400 }
      );
    }

    const card = await addCard(uid, nickname);

    // Log system event
    try {
      await addSystemEvent('card_added', `Card added: ${nickname || uid}`);
    } catch { /* non-critical */ }

    return NextResponse.json({
      success: true,
      card: {
        uid: card.uid,
        nickname: card.displayName,
        addedAt: card.createdAt.toISOString(),
      },
    });
  } catch (error: any) {
    console.error('Error adding card:', error);

    const isUniqueViolation =
      error?.code === 'P2002' || error?.message?.includes('Unique constraint');

    return NextResponse.json(
      { success: false, message: isUniqueViolation ? 'Card already exists' : 'Internal server error' },
      { status: isUniqueViolation ? 409 : 500 }
    );
  }
}

// DELETE /api/cards - Remove card (protected by middleware session check)
export async function DELETE(request: NextRequest) {
  try {
    const body = await request.json();
    const { uid } = body;

    if (!uid) {
      return NextResponse.json(
        { success: false, message: 'Card UID is required' },
        { status: 400 }
      );
    }

    await removeCard(uid);

    // Log system event
    try {
      await addSystemEvent('card_removed', `Card removed: ${uid}`);
    } catch { /* non-critical */ }

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error('Error removing card:', error);

    const isNotFound = error?.code === 'P2025';
    return NextResponse.json(
      { success: false, message: isNotFound ? 'Card not found' : 'Internal server error' },
      { status: isNotFound ? 404 : 500 }
    );
  }
}

// PUT /api/cards - Update card displayName (protected by middleware session check)
export async function PUT(request: NextRequest) {
  try {
    const body = await request.json();
    const { uid, nickname, displayName } = body;

    if (!uid) {
      return NextResponse.json(
        { success: false, message: 'Card UID is required' },
        { status: 400 }
      );
    }

    const name = nickname || displayName;

    if (!name) {
      return NextResponse.json(
        { success: false, message: 'Name is required' },
        { status: 400 }
      );
    }

    const card = await updateCardName(uid, name);
    return NextResponse.json({
      success: true,
      card: {
        uid: card.uid,
        nickname: card.displayName,
        addedAt: card.createdAt.toISOString(),
      },
    });
  } catch (error: any) {
    console.error('Error updating card:', error);

    const isNotFound = error?.code === 'P2025';
    return NextResponse.json(
      { success: false, message: isNotFound ? 'Card not found' : 'Internal server error' },
      { status: isNotFound ? 404 : 500 }
    );
  }
}
