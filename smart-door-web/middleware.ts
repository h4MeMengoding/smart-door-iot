import { NextRequest, NextResponse } from 'next/server';

const SESSION_COOKIE = 'smart-door-session';
const SESSION_DURATION = 30 * 24 * 60 * 60 * 1000; // 30 days in ms

// Routes that don't require middleware authentication
// (some handle their own auth internally, e.g. API key check)
const PUBLIC_PATHS = [
  '/api/auth/login',
  '/api/auth/check',
  '/api/auth/logout',
  '/api/logs',        // Access log persistence (handles own auth via x-api-key or session)
  '/api/logs/stream', // SSE stream (deprecated)
  '/api/health',
  '/api/door',        // Door control for iOS Shortcuts (handles own auth via x-api-key or session)
  '/login',
];

function isPublicPath(pathname: string): boolean {
  return PUBLIC_PATHS.some(p => pathname === p || pathname.startsWith(p + '/'));
}

async function hmacSign(token: string, secret: string): Promise<string> {
  const encoder = new TextEncoder();
  const key = await crypto.subtle.importKey(
    'raw',
    encoder.encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  );
  const signature = await crypto.subtle.sign('HMAC', key, encoder.encode(token));
  return Array.from(new Uint8Array(signature))
    .map(b => b.toString(16).padStart(2, '0'))
    .join('');
}

async function verifySessionCookie(cookieValue: string): Promise<boolean> {
  try {
    const parts = cookieValue.split('.');
    if (parts.length !== 2) return false;

    const [token, signature] = parts;
    const secret = process.env.AUTH_SESSION_SECRET || '';
    if (!secret) return false;
    const expectedSignature = await hmacSign(token, secret);

    // Constant-time comparison
    if (signature.length !== expectedSignature.length) return false;
    let result = 0;
    for (let i = 0; i < signature.length; i++) {
      result |= signature.charCodeAt(i) ^ expectedSignature.charCodeAt(i);
    }
    if (result !== 0) return false;

    // Check expiry from embedded timestamp (token format: randomHex:timestamp)
    const colonIdx = token.lastIndexOf(':');
    if (colonIdx === -1) return false;
    const createdAt = parseInt(token.substring(colonIdx + 1), 10);
    if (isNaN(createdAt)) return false;
    if (Date.now() - createdAt > SESSION_DURATION) return false;

    return true;
  } catch {
    return false;
  }
}

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Allow public paths
  if (isPublicPath(pathname)) {
    return NextResponse.next();
  }

  // Allow static assets, Next.js internals, and PWA files
  if (
    pathname.startsWith('/_next') ||
    pathname.startsWith('/favicon') ||
    pathname === '/sw.js' ||
    pathname === '/manifest.json' ||
    pathname.includes('.')
  ) {
    return NextResponse.next();
  }

  // Check session cookie
  const sessionCookie = request.cookies.get(SESSION_COOKIE);
  const isValid = sessionCookie?.value ? await verifySessionCookie(sessionCookie.value) : false;

  if (!isValid) {
    // For API routes, return 401
    if (pathname.startsWith('/api/')) {
      return NextResponse.json(
        { success: false, message: 'Unauthorized' },
        { status: 401 }
      );
    }

    // For pages, redirect to login
    if (pathname !== '/login') {
      const loginUrl = new URL('/login', request.url);
      return NextResponse.redirect(loginUrl);
    }
  }

  // Authenticated user trying to access /login → redirect to dashboard
  if (pathname === '/login' && isValid) {
    return NextResponse.redirect(new URL('/', request.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    /*
     * Match all request paths except:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     */
    '/((?!_next/static|_next/image|favicon.ico).*)',
  ],
};
