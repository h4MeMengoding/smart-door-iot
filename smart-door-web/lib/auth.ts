import { cookies } from 'next/headers';

// ─── Constants ────────────────────────────────────────────────
const SESSION_COOKIE = 'smart-door-session';
const ATTEMPTS_PREFIX = 'login-attempts:';
const MAX_ATTEMPTS = 5;
const LOCKOUT_DURATION = 5 * 60 * 1000; // 5 minutes in ms
const SESSION_DURATION = 30 * 24 * 60 * 60 * 1000; // 30 days in ms

// ─── In-memory rate limiting store ────────────────────────────
// Survives hot reload via globalThis
const globalForAuth = globalThis as unknown as {
  loginAttempts: Map<string, { count: number; lockedUntil: number }> | undefined;
};

const loginAttempts = globalForAuth.loginAttempts ?? new Map<string, { count: number; lockedUntil: number }>();

if (process.env.NODE_ENV !== 'production') {
  globalForAuth.loginAttempts = loginAttempts;
}

// ─── Web Crypto Helpers (Edge-compatible) ─────────────────────

const encoder = new TextEncoder();

async function sha256Hex(data: string): Promise<string> {
  const hash = await crypto.subtle.digest('SHA-256', encoder.encode(data));
  return Array.from(new Uint8Array(hash)).map(b => b.toString(16).padStart(2, '0')).join('');
}

async function hmacSign(payload: string, secret: string): Promise<string> {
  const key = await crypto.subtle.importKey(
    'raw',
    encoder.encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  );
  const signature = await crypto.subtle.sign('HMAC', key, encoder.encode(payload));
  return Array.from(new Uint8Array(signature)).map(b => b.toString(16).padStart(2, '0')).join('');
}

function constantTimeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let result = 0;
  for (let i = 0; i < a.length; i++) {
    result |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return result === 0;
}

function randomHex(bytes: number): string {
  const arr = new Uint8Array(bytes);
  crypto.getRandomValues(arr);
  return Array.from(arr).map(b => b.toString(16).padStart(2, '0')).join('');
}

// ─── PIN Verification ────────────────────────────────────────
export async function verifyPin(pin: string): Promise<boolean> {
  const expectedHash = process.env.DASHBOARD_PIN_HASH;
  const salt = process.env.DASHBOARD_PIN_SALT || 'smart-door-salt-v1';

  if (!expectedHash) {
    console.error('DASHBOARD_PIN_HASH not set in environment');
    return false;
  }

  // Validate PIN format: must be exactly 6 digits
  if (!/^\d{6}$/.test(pin)) {
    return false;
  }

  const inputHash = await sha256Hex(pin + salt);

  return constantTimeEqual(inputHash, expectedHash);
}

// ─── Rate Limiting ───────────────────────────────────────────
export function checkRateLimit(ip: string): { allowed: boolean; remainingAttempts: number; lockedUntil?: number } {
  const key = `${ATTEMPTS_PREFIX}${ip}`;
  const record = loginAttempts.get(key);

  if (!record) {
    return { allowed: true, remainingAttempts: MAX_ATTEMPTS };
  }

  // Check if lockout has expired
  if (record.lockedUntil > 0 && Date.now() < record.lockedUntil) {
    return {
      allowed: false,
      remainingAttempts: 0,
      lockedUntil: record.lockedUntil,
    };
  }

  // Reset if lockout expired
  if (record.lockedUntil > 0 && Date.now() >= record.lockedUntil) {
    loginAttempts.delete(key);
    return { allowed: true, remainingAttempts: MAX_ATTEMPTS };
  }

  const remaining = MAX_ATTEMPTS - record.count;
  return { allowed: remaining > 0, remainingAttempts: Math.max(0, remaining) };
}

export function recordFailedAttempt(ip: string): { remainingAttempts: number; lockedUntil?: number } {
  const key = `${ATTEMPTS_PREFIX}${ip}`;
  const record = loginAttempts.get(key) || { count: 0, lockedUntil: 0 };

  record.count += 1;

  if (record.count >= MAX_ATTEMPTS) {
    record.lockedUntil = Date.now() + LOCKOUT_DURATION;
    loginAttempts.set(key, record);
    return { remainingAttempts: 0, lockedUntil: record.lockedUntil };
  }

  loginAttempts.set(key, record);
  return { remainingAttempts: MAX_ATTEMPTS - record.count };
}

export function clearAttempts(ip: string): void {
  loginAttempts.delete(`${ATTEMPTS_PREFIX}${ip}`);
}

// ─── Session Management ──────────────────────────────────────

export async function createSession(ip: string): Promise<string> {
  // Token format: randomHex:timestamp — timestamp enables expiry check without server state
  const random = randomHex(32);
  const token = `${random}:${Date.now()}`;
  const secret = process.env.AUTH_SESSION_SECRET;
  if (!secret) throw new Error('AUTH_SESSION_SECRET environment variable is required');
  const signature = await hmacSign(token, secret);
  const sessionId = `${token}.${signature}`;

  // Set cookie — 30 day maxAge
  const cookieStore = await cookies();
  cookieStore.set(SESSION_COOKIE, sessionId, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'strict',
    maxAge: SESSION_DURATION / 1000,
    path: '/',
  });

  return sessionId;
}

export async function validateSession(): Promise<boolean> {
  try {
    const cookieStore = await cookies();
    const sessionCookie = cookieStore.get(SESSION_COOKIE);

    if (!sessionCookie?.value) return false;

    return verifySessionCookie(sessionCookie.value);
  } catch {
    return false;
  }
}

/**
 * Verify a session cookie value (token.signature) without reading from cookie store.
 * Uses Web Crypto API — Edge Runtime compatible.
 */
export async function verifySessionCookie(cookieValue: string): Promise<boolean> {
  try {
    const parts = cookieValue.split('.');
    if (parts.length !== 2) return false;

    const [token, signature] = parts;
    const secret = process.env.AUTH_SESSION_SECRET || '';
    if (!secret) return false;

    // Verify HMAC signature using Web Crypto API
    const expectedSignature = await hmacSign(token, secret);
    if (!constantTimeEqual(signature, expectedSignature)) return false;

    // Check expiry from embedded timestamp
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

export async function destroySession(): Promise<void> {
  try {
    const cookieStore = await cookies();
    cookieStore.delete(SESSION_COOKIE);
  } catch {
    // Ignore
  }
}
