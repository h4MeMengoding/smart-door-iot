import { cookies } from 'next/headers';
import crypto from 'crypto';

// ─── Constants ────────────────────────────────────────────────
const SESSION_COOKIE = 'smart-door-session';
const ATTEMPTS_PREFIX = 'login-attempts:';
const MAX_ATTEMPTS = 5;
const LOCKOUT_DURATION = 5 * 60 * 1000; // 5 minutes in ms
const SESSION_DURATION = 24 * 60 * 60 * 1000; // 24 hours in ms

// ─── In-memory rate limiting store ────────────────────────────
// Survives hot reload via globalThis
const globalForAuth = globalThis as unknown as {
  loginAttempts: Map<string, { count: number; lockedUntil: number }> | undefined;
  sessions: Map<string, { expiresAt: number; ip: string }> | undefined;
};

const loginAttempts = globalForAuth.loginAttempts ?? new Map<string, { count: number; lockedUntil: number }>();
const sessions = globalForAuth.sessions ?? new Map<string, { expiresAt: number; ip: string }>();

if (process.env.NODE_ENV !== 'production') {
  globalForAuth.loginAttempts = loginAttempts;
  globalForAuth.sessions = sessions;
}

// ─── PIN Verification ────────────────────────────────────────
export function verifyPin(pin: string): boolean {
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

  const inputHash = crypto
    .createHash('sha256')
    .update(pin + salt)
    .digest('hex');

  // Timing-safe comparison to prevent timing attacks
  try {
    return crypto.timingSafeEqual(
      Buffer.from(inputHash, 'hex'),
      Buffer.from(expectedHash, 'hex')
    );
  } catch {
    return false;
  }
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
function generateSessionToken(): string {
  return crypto.randomBytes(32).toString('hex');
}

function signSession(token: string): string {
  const secret = process.env.AUTH_SESSION_SECRET || 'default-secret';
  return crypto
    .createHmac('sha256', secret)
    .update(token)
    .digest('hex');
}

export async function createSession(ip: string): Promise<string> {
  const token = generateSessionToken();
  const signature = signSession(token);
  const sessionId = `${token}.${signature}`;

  sessions.set(token, {
    expiresAt: Date.now() + SESSION_DURATION,
    ip,
  });

  // Set cookie
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

    const parts = sessionCookie.value.split('.');
    if (parts.length !== 2) return false;

    const [token, signature] = parts;

    // Verify signature
    const expectedSignature = signSession(token);
    const sigMatch = crypto.timingSafeEqual(
      Buffer.from(signature, 'hex'),
      Buffer.from(expectedSignature, 'hex')
    );
    if (!sigMatch) return false;

    // Check session exists and not expired
    const session = sessions.get(token);
    if (!session) return false;
    if (Date.now() > session.expiresAt) {
      sessions.delete(token);
      return false;
    }

    return true;
  } catch {
    return false;
  }
}

export async function destroySession(): Promise<void> {
  try {
    const cookieStore = await cookies();
    const sessionCookie = cookieStore.get(SESSION_COOKIE);

    if (sessionCookie?.value) {
      const parts = sessionCookie.value.split('.');
      if (parts.length === 2) {
        sessions.delete(parts[0]);
      }
    }

    cookieStore.delete(SESSION_COOKIE);
  } catch {
    // Ignore
  }
}
