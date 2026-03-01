import { NextResponse } from 'next/server';
import { clearSessionCookie } from '@/lib/auth';

export const dynamic = 'force-dynamic';

// POST /api/auth/logout — destroy session cookie
export async function POST() {
  try {
    await clearSessionCookie();
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Logout error:', error);
    return NextResponse.json({ success: false }, { status: 500 });
  }
}
