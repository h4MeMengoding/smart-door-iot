import { NextResponse } from 'next/server';
import { validateSession } from '@/lib/auth';

export const runtime = 'edge';
export const dynamic = 'force-dynamic';

export async function GET() {
  const isValid = await validateSession();
  return NextResponse.json({ authenticated: isValid });
}
