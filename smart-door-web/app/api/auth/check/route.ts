import { NextResponse } from 'next/server';
import { isAuthenticated, isPinConfigured } from '@/lib/auth';

export const dynamic = 'force-dynamic';

// GET /api/auth/check — check auth status for client-side routing
export async function GET() {
  try {
    const configured = await isPinConfigured();
    const authenticated = await isAuthenticated();

    return NextResponse.json({
      configured,    // true if PIN has been set
      authenticated, // true if session is valid (or no PIN configured)
    });
  } catch {
    return NextResponse.json(
      { configured: false, authenticated: true },
      { status: 500 }
    );
  }
}
