import { NextResponse } from 'next/server';

export const runtime = 'edge';
export const dynamic = 'force-dynamic';

// Auth removed — no-op (Cloudflare Access handles auth)
export async function POST() {
  return NextResponse.json({ success: true });
}
