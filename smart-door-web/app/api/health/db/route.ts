import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export const dynamic = 'force-dynamic';

export async function GET() {
  const headers = { 'Cache-Control': 'no-store' };
  try {
    const start = Date.now();
    await prisma.$queryRaw`SELECT 1`;
    return NextResponse.json({ connected: true, latency: Date.now() - start }, { headers });
  } catch (error) {
    console.error('DB health check failed:', error);
    return NextResponse.json({ connected: false }, { status: 503, headers });
  }
}
