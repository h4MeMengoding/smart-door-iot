import { NextRequest, NextResponse } from 'next/server';
import { isAuthenticated, setPin, isPinConfigured, verifyCurrentPin } from '@/lib/auth';

export const dynamic = 'force-dynamic';

// POST /api/auth/pin — set or change PIN
// Body: { pin: "123456" } for initial setup
// Body: { currentPin: "123456", newPin: "654321" } for changing
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { pin, currentPin, newPin } = body;

    const configured = await isPinConfigured();

    if (!configured) {
      // First-time setup — no auth required
      const targetPin = pin || newPin;
      if (!targetPin || !/^\d{6}$/.test(targetPin)) {
        return NextResponse.json(
          { success: false, message: 'PIN must be exactly 6 digits' },
          { status: 400 }
        );
      }

      const ok = await setPin(targetPin);
      return ok
        ? NextResponse.json({ success: true, message: 'PIN set successfully' })
        : NextResponse.json({ success: false, message: 'Failed to set PIN' }, { status: 500 });
    }

    // PIN already exists — must be authenticated to change
    const authenticated = await isAuthenticated();
    if (!authenticated) {
      return NextResponse.json(
        { success: false, message: 'Authentication required' },
        { status: 401 }
      );
    }

    // Changing PIN — verify current PIN first
    if (!currentPin || !newPin) {
      return NextResponse.json(
        { success: false, message: 'Both currentPin and newPin are required' },
        { status: 400 }
      );
    }

    if (!/^\d{6}$/.test(newPin)) {
      return NextResponse.json(
        { success: false, message: 'New PIN must be exactly 6 digits' },
        { status: 400 }
      );
    }

    // Verify current PIN directly (no rate-limit impact)
    const valid = await verifyCurrentPin(currentPin);
    if (!valid) {
      return NextResponse.json(
        { success: false, message: 'Current PIN is incorrect' },
        { status: 401 }
      );
    }

    const ok = await setPin(newPin);
    return ok
      ? NextResponse.json({ success: true, message: 'PIN changed successfully' })
      : NextResponse.json({ success: false, message: 'Failed to change PIN' }, { status: 500 });
  } catch (error) {
    console.error('PIN error:', error);
    return NextResponse.json(
      { success: false, message: 'Internal server error' },
      { status: 500 }
    );
  }
}
