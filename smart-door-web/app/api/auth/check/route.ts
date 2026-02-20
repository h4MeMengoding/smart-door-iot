import { NextResponse } from 'next/server';

export const runtime = 'edge';
export const dynamic = 'force-dynamic';

// Auth removed — always return authenticated (Cloudflare Access handles auth)
export async function GET() {
  return NextResponse.json({ authenticated: true });
}
