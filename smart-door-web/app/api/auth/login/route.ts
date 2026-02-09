import { NextRequest, NextResponse } from 'next/server';
import { verifyPin, checkRateLimit, recordFailedAttempt, clearAttempts, createSession } from '@/lib/auth';

export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  try {
    const ip = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim()
      || request.headers.get('x-real-ip')
      || '127.0.0.1';

    // Check rate limit
    const rateLimit = checkRateLimit(ip);
    if (!rateLimit.allowed) {
      const retryAfter = rateLimit.lockedUntil
        ? Math.ceil((rateLimit.lockedUntil - Date.now()) / 1000)
        : 300;

      return NextResponse.json(
        {
          success: false,
          message: 'Too many attempts. Please try again later.',
          retryAfter,
          remainingAttempts: 0,
        },
        {
          status: 429,
          headers: { 'Retry-After': String(retryAfter) },
        }
      );
    }

    // Parse body
    const body = await request.json().catch(() => null);
    if (!body || typeof body.pin !== 'string') {
      return NextResponse.json(
        { success: false, message: 'Invalid request' },
        { status: 400 }
      );
    }

    const { pin } = body;

    // Validate PIN format (must be 6 digits)
    if (!/^\d{6}$/.test(pin)) {
      const result = recordFailedAttempt(ip);
      return NextResponse.json(
        {
          success: false,
          message: 'Invalid code',
          remainingAttempts: result.remainingAttempts,
        },
        { status: 401 }
      );
    }

    // Verify PIN
    if (!verifyPin(pin)) {
      const result = recordFailedAttempt(ip);

      if (result.remainingAttempts === 0) {
        return NextResponse.json(
          {
            success: false,
            message: 'Too many attempts. Account locked for 5 minutes.',
            remainingAttempts: 0,
            retryAfter: Math.ceil((result.lockedUntil! - Date.now()) / 1000),
          },
          { status: 429 }
        );
      }

      return NextResponse.json(
        {
          success: false,
          message: 'Invalid code',
          remainingAttempts: result.remainingAttempts,
        },
        { status: 401 }
      );
    }

    // Success — clear attempts and create session
    clearAttempts(ip);
    await createSession(ip);

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Login error:', error);
    return NextResponse.json(
      { success: false, message: 'Internal server error' },
      { status: 500 }
    );
  }
}
