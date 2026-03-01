import { NextRequest, NextResponse } from 'next/server';
import { verifyPin, createSessionToken, setSessionCookie, isPinConfigured } from '@/lib/auth';

export const dynamic = 'force-dynamic';

// POST /api/auth/login — verify PIN and create session
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { pin } = body;

    if (!pin || typeof pin !== 'string') {
      return NextResponse.json(
        { success: false, message: 'PIN is required' },
        { status: 400 }
      );
    }

    // Check if PIN is configured
    const configured = await isPinConfigured();
    if (!configured) {
      return NextResponse.json(
        { success: false, message: 'No PIN configured. Set a PIN in settings first.' },
        { status: 403 }
      );
    }

    // Verify PIN (rate-limited)
    const result = await verifyPin(pin);

    if (result.locked) {
      return NextResponse.json(
        {
          success: false,
          locked: true,
          lockoutSeconds: result.lockoutSeconds,
          message: `Too many attempts. Try again in ${Math.ceil((result.lockoutSeconds || 300) / 60)} minutes.`,
        },
        { status: 429 }
      );
    }

    if (!result.success) {
      return NextResponse.json(
        {
          success: false,
          remainingAttempts: result.remainingAttempts,
          message: result.remainingAttempts > 0
            ? `Wrong PIN. ${result.remainingAttempts} attempts remaining.`
            : 'Wrong PIN.',
        },
        { status: 401 }
      );
    }

    // Success — create HMAC-signed session cookie
    const token = await createSessionToken();
    await setSessionCookie(token);

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Login error:', error);
    return NextResponse.json(
      { success: false, message: 'Internal server error' },
      { status: 500 }
    );
  }
}

// GET /api/auth/login — check if PIN is configured
export async function GET() {
  try {
    const configured = await isPinConfigured();
    return NextResponse.json({ configured });
  } catch {
    return NextResponse.json({ configured: false }, { status: 500 });
  }
}
