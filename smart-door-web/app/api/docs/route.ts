import { NextResponse } from 'next/server';
import { readFile } from 'fs/promises';
import { join } from 'path';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs'; // fs requires Node.js

// Cache content in-memory after first read (survives across requests in same isolate)
let cachedContent: string | null = null;

export async function GET() {
  try {
    if (!cachedContent) {
      const filePath = join(process.cwd(), 'docs', 'api.md');
      cachedContent = await readFile(filePath, 'utf-8');
    }
    return new NextResponse(cachedContent, {
      headers: {
        'Content-Type': 'text/plain; charset=utf-8',
        'Cache-Control': 'public, s-maxage=3600, stale-while-revalidate=86400',
      },
    });
  } catch {
    return new NextResponse('# Error\n\nAPI documentation file not found.', {
      status: 404,
      headers: { 'Content-Type': 'text/plain; charset=utf-8' },
    });
  }
}
