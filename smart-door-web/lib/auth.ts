import { prisma } from './prisma';
import { cookies } from 'next/headers';

const SESSION_COOKIE = 'smart-door-session';
const SESSION_MAX_AGE = 30 * 24 * 60 * 60; // 30 days in seconds
const MAX_FAILED_ATTEMPTS = 5;
const LOCKOUT_DURATION_MS = 5 * 60 * 1000; // 5 minutes

// Secret for HMAC signing — derived from VAPID private key or a dedicated env var
function getSecret(): string {
  const secret = process.env.AUTH_SECRET || process.env.VAPID_PRIVATE_KEY;
  if (secret) return secret;
  if (process.env.NODE_ENV === 'production') {
    throw new Error('AUTH_SECRET must be configured in production');
  }
  return 'development-only-secret';
}

// ─── HMAC Signing (Edge-compatible, uses Web Crypto) ───

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

/** Create a signed session cookie value: `{timestamp}.{hmac}` */
export async function createSessionToken(): Promise<string> {
  const timestamp = Date.now().toString();
  const signature = await hmacSign(timestamp);
  return `${timestamp}.${signature}`;
}

/** Verify a session cookie — returns true if valid and not expired */
export async function verifySessionToken(token: string): Promise<boolean> {
  const parts = token.split('.');
  if (parts.length !== 2) return false;

  const [timestamp, signature] = parts;
  const ts = parseInt(timestamp, 10);
  if (isNaN(ts)) return false;

  // Check expiry (30 days)
  if (Date.now() - ts > SESSION_MAX_AGE * 1000) return false;

  // Verify HMAC
  const expected = await hmacSign(timestamp);
  return signature === expected;
}

// ─── PIN Hashing ───

async function hashPin(pin: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(pin + getSecret()); // salted with secret
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  return Array.from(new Uint8Array(hashBuffer))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

// ─── PIN Management ───

/** Check if a PIN has been set */
export async function isPinConfigured(): Promise<boolean> {
  const count = await prisma.authPin.count();
  return count > 0;
}

/** Set or update the PIN (6 digits) */
export async function setPin(pin: string): Promise<boolean> {
  if (!/^\d{6}$/.test(pin)) return false;

  const pinHash = await hashPin(pin);
  const existing = await prisma.authPin.findFirst();

  if (existing) {
    await prisma.authPin.update({
      where: { id: existing.id },
      data: { pinHash, failedAttempts: 0, lockedUntil: null },
    });
  } else {
    await prisma.authPin.create({
      data: { pinHash },
    });
  }

  return true;
}

/** Verify a PIN attempt — returns { success, locked, remainingAttempts } */
export async function verifyPin(pin: string): Promise<{
  success: boolean;
  locked: boolean;
  remainingAttempts: number;
  lockoutSeconds?: number;
}> {
  const authPin = await prisma.authPin.findFirst();

  if (!authPin) {
    return { success: false, locked: false, remainingAttempts: 0 };
  }

  // Check lockout
  if (authPin.lockedUntil && authPin.lockedUntil > new Date()) {
    const lockoutSeconds = Math.ceil((authPin.lockedUntil.getTime() - Date.now()) / 1000);
    return { success: false, locked: true, remainingAttempts: 0, lockoutSeconds };
  }

  // Reset failed attempts if lockout has expired
  if (authPin.lockedUntil && authPin.lockedUntil <= new Date()) {
    await prisma.authPin.update({
      where: { id: authPin.id },
      data: { failedAttempts: 0, lockedUntil: null },
    });
    authPin.failedAttempts = 0;
  }

  const pinHash = await hashPin(pin);

  if (pinHash === authPin.pinHash) {
    // Success — reset failed attempts
    await prisma.authPin.update({
      where: { id: authPin.id },
      data: { failedAttempts: 0, lockedUntil: null },
    });
    return { success: true, locked: false, remainingAttempts: MAX_FAILED_ATTEMPTS };
  }

  // Failed attempt
  const newFailed = authPin.failedAttempts + 1;
  const remaining = Math.max(0, MAX_FAILED_ATTEMPTS - newFailed);
  const shouldLock = newFailed >= MAX_FAILED_ATTEMPTS;

  await prisma.authPin.update({
    where: { id: authPin.id },
    data: {
      failedAttempts: newFailed,
      lockedUntil: shouldLock ? new Date(Date.now() + LOCKOUT_DURATION_MS) : null,
    },
  });

  return {
    success: false,
    locked: shouldLock,
    remainingAttempts: remaining,
    lockoutSeconds: shouldLock ? Math.ceil(LOCKOUT_DURATION_MS / 1000) : undefined,
  };
}

/** Verify current PIN hash directly (for PIN change) — does not affect rate limiting */
export async function verifyCurrentPin(pin: string): Promise<boolean> {
  const authPin = await prisma.authPin.findFirst();
  if (!authPin) return false;
  const pinHash = await hashPin(pin);
  return pinHash === authPin.pinHash;
}

// ─── Cookie Management ───

/** Set session cookie */
export async function setSessionCookie(token: string): Promise<void> {
  const isSecure = process.env.SECURE_COOKIES === 'true' || 
                  (process.env.NODE_ENV === 'production' && process.env.VERCEL === '1');
                  
  (await cookies()).set(SESSION_COOKIE, token, {
    httpOnly: true,
    secure: isSecure,
    sameSite: 'lax',
    maxAge: SESSION_MAX_AGE,
    path: '/',
  });
}

/** Get session token from cookie */
export async function getSessionToken(): Promise<string | undefined> {
  return (await cookies()).get(SESSION_COOKIE)?.value;
}

/** Clear session cookie */
export async function clearSessionCookie(): Promise<void> {
  (await cookies()).delete(SESSION_COOKIE);
}

/** Check if current request is authenticated (for server components / API routes) */
export async function isAuthenticated(): Promise<boolean> {
  // If no PIN is configured, allow access
  const pinConfigured = await isPinConfigured();
  if (!pinConfigured) return true;

  const token = await getSessionToken();
  if (!token) return false;

  return verifySessionToken(token);
}
