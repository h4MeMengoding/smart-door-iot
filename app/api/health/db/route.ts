import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    // Simple query to check if DB is reachable
    await prisma.$queryRaw`SELECT 1`;
    return NextResponse.json({ connected: true });
  } catch (error) {
    console.error('DB health check failed:', error);
    return NextResponse.json({ connected: false });
  }
}
