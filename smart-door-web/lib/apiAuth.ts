import { NextRequest, NextResponse } from 'next/server';
import { isAuthenticated } from './auth';

/**
 * Protect API routes for both the dashboard session and iOS Shortcuts.
 * In production, AUTH_SECRET must be explicitly configured; the development
 * fallback in auth.ts must never be accepted for public deployments.
 */
export async function requireApiAccess(request: NextRequest): Promise<NextResponse | null> {
  const configuredApiKey = process.env.ESP32_API_KEY;
  const suppliedApiKey = request.headers.get('X-API-Key') || request.headers.get('x-api-key');

  if (process.env.NODE_ENV === 'production' && !process.env.AUTH_SECRET) {
    return NextResponse.json({ success: false, message: 'Authentication is not configured' }, { status: 503 });
  }

  if (configuredApiKey && suppliedApiKey === configuredApiKey) return null;
  if (await isAuthenticated()) return null;

  return NextResponse.json({ success: false, message: 'Unauthorized' }, { status: 401 });
}
