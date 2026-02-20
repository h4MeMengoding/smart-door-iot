import { NextRequest, NextResponse } from 'next/server';

// ============================================
// Middleware — Auth removed (handled by Cloudflare Access)
// ============================================
// All routes are public. Only /login redirects to / since login is removed.

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Redirect /login to dashboard (login page removed)
  if (pathname === '/login') {
    return NextResponse.redirect(new URL('/', request.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: ['/login'],
};
