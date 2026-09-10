import { NextRequest, NextResponse } from 'next/server';

const SESSION_COOKIE = 'smart-door-session';
const SESSION_MAX_AGE_MS = 30 * 24 * 60 * 60 * 1000; // 30 days

function getSecret(): string {
  return process.env.AUTH_SECRET || process.env.VAPID_PRIVATE_KEY || 'smart-door-default-secret';
}

async function hmacSign(data: string): Promise<string> {
  const encoder = new TextEncoder();
  const key = await crypto.subtle.importKey(
    'raw',
    encoder.encode(getSecret()),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  );
  const sig = await crypto.subtle.sign('HMAC', key, encoder.encode(data));
  return Array.from(new Uint8Array(sig))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

async function verifyToken(token: string): Promise<boolean> {
  const parts = token.split('.');
  if (parts.length !== 2) return false;

  const [timestamp, signature] = parts;
  const ts = parseInt(timestamp, 10);
  if (isNaN(ts)) return false;

  // Check expiry
  if (Date.now() - ts > SESSION_MAX_AGE_MS) return false;

  // Verify HMAC
  const expected = await hmacSign(timestamp);

  // Constant-time comparison
  if (signature.length !== expected.length) return false;
  let mismatch = 0;
  for (let i = 0; i < signature.length; i++) {
    mismatch |= signature.charCodeAt(i) ^ expected.charCodeAt(i);
  }
  return mismatch === 0;
}

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Prevent caching of protected pages — ensures middleware always runs
  const addNoCacheHeaders = (response: NextResponse) => {
    response.headers.set('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
    response.headers.set('Pragma', 'no-cache');
    response.headers.set('Expires', '0');
    return response;
  };

  // Check session cookie — no DB call needed (HMAC verification only)
  const sessionToken = request.cookies.get(SESSION_COOKIE)?.value;

  if (sessionToken) {
    const valid = await verifyToken(sessionToken);
    if (valid) {
      return addNoCacheHeaders(NextResponse.next()); // Authenticated
    }
    // Invalid/expired token — clear it
    const response = NextResponse.next();
    response.cookies.delete(SESSION_COOKIE);
  }

  // No valid session — check if PIN is configured via API
  // This is the only case where we need a DB check
  try {
    const checkUrl = new URL('/api/auth/check', request.url);
    const checkRes = await fetch(checkUrl);

    if (checkRes.ok) {
      const { configured } = await checkRes.json();
      if (!configured) {
        return NextResponse.next(); // No PIN set → allow access
      }
    }
  } catch {
    // Fail-closed: if auth check fails, redirect to login
    // Prevents bypass when internal fetch errors occur
    const loginUrl = new URL('/login', request.url);
    if (pathname !== '/') {
      loginUrl.searchParams.set('redirect', pathname);
    }
    return NextResponse.redirect(loginUrl);
  }

  // PIN is configured but no valid session → redirect to login
  const loginUrl = new URL('/login', request.url);
  if (pathname !== '/') {
    loginUrl.searchParams.set('redirect', pathname);
  }
  return NextResponse.redirect(loginUrl);
}

export const config = {
  matcher: ['/', '/docs/:path*'],
};

