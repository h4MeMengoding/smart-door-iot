'use client';

import { useState, useEffect, useRef, useCallback, Suspense } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Lock, AlertCircle, Loader2, Eye, EyeOff,
  Wifi, WifiOff, CreditCard, Clock,
  CheckCircle2, Database, HardDrive, LockOpen,
} from 'lucide-react';
import { useSearchParams } from 'next/navigation';

// ─── Types ───

interface SystemStats {
  doorStatus: 'LOCKED' | 'UNLOCKED' | null;
  uptime: string | null;
  cardCount: number | null;
  rssi: number | null;
  freeHeap: number | null;
  ip: string | null;
  espOnline: boolean;
  dbConnected: boolean | null;
  dbLatency: number | null;
}

// ─── Page Wrapper ───

export default function LoginPage() {
  return (
    <Suspense fallback={
      <div className="h-[100dvh] flex items-center justify-center">
        <Loader2 className="w-5 h-5 animate-spin" style={{ color: 'var(--text-muted)' }} />
      </div>
    }>
      <LoginContent />
    </Suspense>
  );
}

// ─── Stat Item ───

function StatItem({ icon, label, value, color, online }: {
  icon: React.ReactNode;
  label: string;
  value: string;
  color: string;
  online?: boolean;
}) {
  return (
    <div className="flex items-center gap-2.5 min-w-0">
      <div className="relative shrink-0">
        <div
          className="w-7 h-7 rounded-lg flex items-center justify-center"
          style={{ background: `color-mix(in srgb, ${color} 12%, transparent)` }}
        >
          <div style={{ color }}>{icon}</div>
        </div>
        {online !== undefined && (
          <div
            className="absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 rounded-full border-2"
            style={{
              background: online ? 'var(--success)' : 'var(--danger)',
              borderColor: 'var(--bg-surface)',
            }}
          />
        )}
      </div>
      <div className="min-w-0">
        <p className="text-[10px] font-medium leading-none mb-0.5" style={{ color: 'var(--text-muted)' }}>{label}</p>
        <p className="text-[12px] font-semibold leading-none truncate" style={{ color: 'var(--text-primary)' }}>{value}</p>
      </div>
    </div>
  );
}

// ─── System Stats Panel ───

function SystemStats({ stats }: { stats: SystemStats }) {
  const formatHeap = (bytes: number | null) => {
    if (bytes === null) return '—';
    return `${(bytes / 1024).toFixed(0)} KB`;
  };

  const formatUptime = (raw: string | null): string => {
    if (!raw) return '—';
    const seconds = parseInt(raw);
    if (isNaN(seconds)) return raw;
    const hours = seconds / 3600;
    if (hours < 1) return `${Math.round(seconds / 60)}m`;
    return `${hours.toFixed(1)}h`;
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.6, duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
      className="overflow-hidden"
    >
      {/* Header */}
      <div
        className="flex items-center justify-between px-1 py-2.5"
      >
        <span className="text-[11px] font-semibold uppercase tracking-wider" style={{ color: 'var(--text-muted)' }}>
          System Status
        </span>
        <div className="flex items-center gap-1.5">
          <div
            className="w-1.5 h-1.5 rounded-full"
            style={{ background: stats.espOnline ? 'var(--success)' : 'var(--danger)' }}
          />
          <span className="text-[10px] font-medium" style={{ color: stats.espOnline ? 'var(--success-text)' : 'var(--danger-text)' }}>
            {stats.espOnline ? 'Online' : 'Offline'}
          </span>
        </div>
      </div>

      {/* Stats grid */}
      <div className="grid grid-cols-2 gap-x-4 gap-y-3 px-1">
        {[
          {
            icon: stats.espOnline ? <Wifi className="w-3.5 h-3.5" /> : <WifiOff className="w-3.5 h-3.5" />,
            label: 'WiFi Signal',
            value: stats.rssi !== null ? `${stats.rssi} dBm` : '—',
            color: stats.rssi !== null && stats.rssi > -60 ? 'var(--success)' : 'var(--warning)',
            online: stats.espOnline,
          },
          {
            icon: stats.doorStatus === 'UNLOCKED'
              ? <LockOpen className="w-3.5 h-3.5" />
              : <Lock className="w-3.5 h-3.5" />,
            label: 'Door',
            value: stats.doorStatus ?? '—',
            color: stats.doorStatus === 'LOCKED' ? 'var(--success)' : stats.doorStatus === 'UNLOCKED' ? 'var(--warning)' : 'var(--text-muted)',
          },
          {
            icon: <CreditCard className="w-3.5 h-3.5" />,
            label: 'RFID Cards',
            value: stats.cardCount !== null ? `${stats.cardCount} registered` : '—',
            color: 'var(--info)',
          },
          {
            icon: <HardDrive className="w-3.5 h-3.5" />,
            label: 'Free Memory',
            value: formatHeap(stats.freeHeap),
            color: 'var(--secondary)',
          },
          {
            icon: <Database className="w-3.5 h-3.5" />,
            label: 'Database',
            value: stats.dbConnected === null ? '—' : stats.dbConnected ? `${stats.dbLatency ?? 0}ms latency` : 'Offline',
            color: stats.dbConnected ? 'var(--success)' : stats.dbConnected === false ? 'var(--danger)' : 'var(--text-muted)',
          },
          {
            icon: <Clock className="w-3.5 h-3.5" />,
            label: 'Uptime',
            value: formatUptime(stats.uptime),
            color: 'var(--text-muted)',
          },
        ].map((stat, i) => (
          <motion.div
            key={stat.label}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.7 + i * 0.06 }}
          >
            <StatItem {...stat} />
          </motion.div>
        ))}
      </div>

      {/* IP footer */}
      {stats.ip && (
        <div className="px-1 pt-2 text-center">
          <span className="text-[10px] font-mono" style={{ color: 'var(--text-muted)' }}>
            {stats.ip}
          </span>
        </div>
      )}
    </motion.div>
  );
}

// ─── Login Content ───

function LoginContent() {
  const searchParams = useSearchParams();
  const redirect = searchParams.get('redirect') || '/';

  const [pin, setPin] = useState('');
  const [error, setError] = useState('');
  const [locked, setLocked] = useState(false);
  const [lockoutSeconds, setLockoutSeconds] = useState(0);
  const [loading, setLoading] = useState(false);
  const [showPin, setShowPin] = useState(false);
  const [shake, setShake] = useState(false);
  const [success, setSuccess] = useState(false);
  const [remainingAttempts, setRemainingAttempts] = useState<number | null>(null);

  const [stats, setStats] = useState<SystemStats>({
    doorStatus: null, uptime: null, cardCount: null, rssi: null,
    freeHeap: null, ip: null, espOnline: false, dbConnected: null, dbLatency: null,
  });

  const inputRefs = useRef<(HTMLInputElement | null)[]>([]);

  // ── Fetch system stats ──
  useEffect(() => {
    let aborted = false;
    const fetchStats = async () => {
      const [espRes, dbRes] = await Promise.allSettled([
        fetch('/api/esp?command=door.status').then(r => r.ok ? r.json() : null),
        fetch('/api/health/db').then(r => r.ok ? r.json() : null),
      ]);
      if (aborted) return;
      const espData = espRes.status === 'fulfilled' ? espRes.value : null;
      const dbData = dbRes.status === 'fulfilled' ? dbRes.value : null;

      let sysData: Record<string, unknown> | null = null;
      try {
        const sysRes = await fetch('/api/esp?command=system.info');
        if (sysRes.ok) sysData = await sysRes.json();
      } catch { /* ignore */ }
      if (aborted) return;

      setStats({
        doorStatus: espData?.doorStatus ?? null,
        uptime: espData?.uptime ?? sysData?.uptime as string ?? null,
        cardCount: espData?.cardCount ?? null,
        rssi: sysData?.rssi as number ?? null,
        freeHeap: sysData?.freeHeap as number ?? null,
        ip: sysData?.ip as string ?? null,
        espOnline: !!espData,
        dbConnected: dbData ? dbData.connected : null,
        dbLatency: dbData?.latency ?? null,
      });
    };
    fetchStats();
    const interval = setInterval(fetchStats, 15000);
    return () => { aborted = true; clearInterval(interval); };
  }, []);

  // ── Lockout countdown ──
  useEffect(() => {
    if (lockoutSeconds <= 0) return;
    const interval = setInterval(() => {
      setLockoutSeconds(s => {
        if (s <= 1) { setLocked(false); setError(''); return 0; }
        return s - 1;
      });
    }, 1000);
    return () => clearInterval(interval);
  }, [lockoutSeconds]);

  // ── Focus first input ──
  useEffect(() => {
    setTimeout(() => inputRefs.current[0]?.focus(), 400);
  }, []);

  const triggerShake = useCallback(() => {
    setShake(true);
    setTimeout(() => setShake(false), 600);
  }, []);

  const handleSubmit = useCallback(async (fullPin: string) => {
    if (loading || locked || fullPin.length !== 6) return;
    setLoading(true);
    setError('');

    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ pin: fullPin }),
      });
      const data = await res.json();

      if (data.success) {
        setSuccess(true);
        // Hard navigation to ensure fresh server render (no stale Router Cache)
        setTimeout(() => { window.location.href = redirect; }, 900);
        return;
      }

      if (data.locked) {
        setLocked(true);
        setLockoutSeconds(data.lockoutSeconds || 300);
        setError(data.message);
      } else {
        setError(data.message || 'Incorrect PIN');
        setRemainingAttempts(data.remainingAttempts ?? null);
      }
      triggerShake();
      setTimeout(() => { setPin(''); inputRefs.current[0]?.focus(); }, 450);
    } catch {
      setError('Connection failed');
      triggerShake();
      setTimeout(() => { setPin(''); inputRefs.current[0]?.focus(); }, 450);
    } finally {
      setLoading(false);
    }
  }, [loading, locked, redirect, triggerShake]);

  const handleDigitInput = useCallback((index: number, value: string) => {
    if (locked || loading) return;
    const digit = value.replace(/\D/g, '').slice(-1);
    const newPin = pin.split('');
    newPin[index] = digit;
    while (newPin.length < 6) newPin.push('');
    const joined = newPin.join('');
    setPin(joined);
    setError('');
    if (digit && index < 5) inputRefs.current[index + 1]?.focus();
    const filtered = joined.replace(/\D/g, '');
    if (filtered.length === 6) handleSubmit(filtered);
  }, [pin, locked, loading, handleSubmit]);

  const handleKeyDown = useCallback((index: number, e: React.KeyboardEvent) => {
    if (e.key === 'Backspace') {
      e.preventDefault();
      const newPin = pin.split('');
      if (newPin[index]) { newPin[index] = ''; setPin(newPin.join('')); }
      else if (index > 0) { newPin[index - 1] = ''; setPin(newPin.join('')); inputRefs.current[index - 1]?.focus(); }
    } else if (e.key === 'ArrowLeft' && index > 0) inputRefs.current[index - 1]?.focus();
    else if (e.key === 'ArrowRight' && index < 5) inputRefs.current[index + 1]?.focus();
  }, [pin]);

  const handlePaste = useCallback((e: React.ClipboardEvent) => {
    e.preventDefault();
    const pasted = e.clipboardData.getData('text').replace(/\D/g, '').slice(0, 6);
    if (pasted.length > 0) {
      setPin(pasted.padEnd(6, ''));
      inputRefs.current[Math.min(pasted.length, 5)]?.focus();
      if (pasted.length === 6) handleSubmit(pasted);
    }
  }, [handleSubmit]);

  const formatLockout = (s: number) => `${Math.floor(s / 60)}:${(s % 60).toString().padStart(2, '0')}`;
  const filledCount = pin.replace(/[^0-9]/g, '').length;

  // ─── Time display ───
  const [time, setTime] = useState<string>('');
  const [dateStr, setDateStr] = useState<string>('');
  useEffect(() => {
    const update = () => {
      const now = new Date();
      setTime(now.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: false }));
      setDateStr(now.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' }));
    };
    update();
    const interval = setInterval(update, 1000);
    return () => clearInterval(interval);
  }, []);

  return (
    <div
      className="min-h-[100dvh] flex items-center justify-center px-4 py-8 sm:px-6 relative overflow-hidden"
    >
      {/* Background accents */}
      <div className="fixed inset-0 pointer-events-none overflow-hidden">
        <div
          className="absolute -top-[30%] -right-[20%] w-[70vw] h-[70vw] max-w-[500px] max-h-[500px] rounded-full opacity-[0.07]"
          style={{ background: `radial-gradient(circle, var(--primary), transparent 70%)` }}
        />
        <div
          className="absolute -bottom-[20%] -left-[15%] w-[50vw] h-[50vw] max-w-[400px] max-h-[400px] rounded-full opacity-[0.05]"
          style={{ background: `radial-gradient(circle, var(--secondary), transparent 70%)` }}
        />
      </div>

      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.5 }}
        className="w-full max-w-[920px] relative z-10 grid grid-cols-1 md:grid-cols-[minmax(0,1fr)_380px] gap-4 md:gap-6 items-center"
      >
        {/* ── Clock + Date ── */}
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1, duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
          className="text-center md:text-left md:px-5 md:pt-3"
        >
          <div className="inline-flex items-center gap-2 mb-4 text-[10px] font-semibold uppercase tracking-[0.22em]" style={{ color: 'var(--primary)' }}>
            <span className="w-1.5 h-1.5 rounded-full" style={{ background: 'var(--primary)', boxShadow: '0 0 12px var(--primary)' }} />
            Smart Door / Secure Access
          </div>
          <motion.p
            className="text-5xl sm:text-6xl font-bold font-mono tabular-nums tracking-[-0.06em]"
            style={{ color: 'var(--text-primary)' }}
            key={time}
            initial={{ opacity: 0.7, y: -2 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3 }}
          >
            {time}
          </motion.p>
          <p className="text-sm mt-2" style={{ color: 'var(--text-muted)' }}>
            {dateStr}
          </p>
          <p className="hidden md:block max-w-[360px] text-sm leading-relaxed mt-6" style={{ color: 'var(--text-secondary)' }}>
            Monitor your entrance, manage access, and keep your home connected from one secure dashboard.
          </p>
        </motion.div>

        {/* ── PIN Section ── */}
        <motion.div
          initial={{ opacity: 0, y: 24 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.15, duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
          className="rounded-[28px] border p-1"
          style={{ background: 'color-mix(in srgb, var(--bg-surface) 88%, transparent)', borderColor: 'var(--border)', boxShadow: 'var(--shadow-lg)' }}
        >
          {/* Top section with icon */}
          <div className="pt-7 pb-5 px-6 flex flex-col items-center">
            {/* Animated icon */}
            <motion.div
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              transition={{ delay: 0.25, type: 'spring', stiffness: 200, damping: 16 }}
              className="mb-4 relative"
            >
              <motion.div
                className="w-14 h-14 rounded-2xl flex items-center justify-center"
                style={{
                  background: success ? 'var(--success-light)' : error ? 'var(--danger-light)' : 'var(--primary-light)',
                  transition: 'background 0.4s ease',
                }}
                animate={success ? { scale: [1, 1.1, 1] } : {}}
                transition={{ duration: 0.4 }}
              >
                <AnimatePresence mode="wait">
                  {success ? (
                    <motion.div key="ok" initial={{ scale: 0, rotate: -90 }} animate={{ scale: 1, rotate: 0 }} transition={{ type: 'spring', stiffness: 250, damping: 14 }}>
                      <CheckCircle2 className="w-7 h-7" style={{ color: 'var(--success)' }} />
                    </motion.div>
                  ) : loading ? (
                    <motion.div key="load" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
                      <Loader2 className="w-7 h-7 animate-spin" style={{ color: 'var(--primary)' }} />
                    </motion.div>
                  ) : (
                    <motion.div key="lock" initial={{ scale: 0 }} animate={{ scale: 1 }} exit={{ scale: 0.5, opacity: 0 }} transition={{ duration: 0.15 }}>
                      <Lock className="w-7 h-7" style={{ color: error ? 'var(--danger)' : 'var(--primary)' }} />
                    </motion.div>
                  )}
                </AnimatePresence>
              </motion.div>

              {/* Pulse ring */}
              {loading && (
                <motion.div
                  className="absolute inset-0 rounded-2xl"
                  style={{ border: '2px solid var(--primary)' }}
                  animate={{ scale: [1, 1.2], opacity: [0.4, 0] }}
                  transition={{ duration: 1, repeat: Infinity }}
                />
              )}
            </motion.div>

            {/* Title */}
            <AnimatePresence mode="wait">
              <motion.div
                key={success ? 's' : error ? 'e' : 'd'}
                initial={{ opacity: 0, y: -6 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: 6 }}
                transition={{ duration: 0.2 }}
                className="text-center"
              >
                <h1 className="text-xl font-bold tracking-tight" style={{ color: 'var(--text-primary)' }}>
                  {success ? 'Welcome Back' : 'Enter PIN'}
                </h1>
                <p className="text-[12px] mt-0.5" style={{ color: 'var(--text-muted)' }}>
                  {success ? 'Redirecting...' : 'Personal use only'}
                </p>
              </motion.div>
            </AnimatePresence>
          </div>

          {/* PIN section */}
          <div className="px-6 pb-6">
            {/* Progress dots */}
            <div className="flex justify-center gap-3 mb-5">
              {Array.from({ length: 6 }).map((_, i) => {
                const isFilled = i < filledCount;
                return (
                  <motion.div
                    key={i}
                    className="w-2.5 h-2.5 rounded-full"
                    style={{
                      background: success
                        ? 'var(--success)'
                        : isFilled
                          ? error ? 'var(--danger)' : 'var(--primary)'
                          : 'var(--border)',
                      transition: 'background 0.15s ease',
                    }}
                    animate={
                      shake && isFilled
                        ? { x: [0, -3, 3, -2, 2, 0] }
                        : success && isFilled
                          ? { scale: [1, 1.4, 1] }
                          : isFilled
                            ? { scale: [0.5, 1.2, 1] }
                            : {}
                    }
                    transition={
                      success
                        ? { delay: i * 0.06, duration: 0.3 }
                        : { duration: 0.25 }
                    }
                  />
                );
              })}
            </div>

            {/* Hidden numeric inputs */}
            <motion.div
              animate={shake ? { x: [0, -14, 12, -10, 8, -4, 0] } : {}}
              transition={{ duration: 0.45, ease: 'easeInOut' }}
            >
              <div className="flex justify-center gap-2">
                {Array.from({ length: 6 }).map((_, i) => {
                  const filled = !!pin[i] && pin[i] !== '' && pin[i] !== ' ';
                  const isNext = filledCount === i && !success && !locked;
                  return (
                    <motion.div
                      key={i}
                      initial={{ opacity: 0, y: 12 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: 0.3 + i * 0.04, duration: 0.35, ease: [0.22, 1, 0.36, 1] }}
                      className="relative"
                    >
                      <input
                        ref={el => { inputRefs.current[i] = el; }}
                        type={showPin ? 'text' : 'password'}
                        inputMode="numeric"
                        pattern="[0-9]*"
                        maxLength={1}
                        value={pin[i] || ''}
                        onChange={e => handleDigitInput(i, e.target.value)}
                        onKeyDown={e => handleKeyDown(i, e)}
                        onPaste={i === 0 ? handlePaste : undefined}
                        disabled={locked || loading || success}
                        autoComplete="off"
                        aria-label={`PIN digit ${i + 1}`}
                        className="w-11 h-12 text-center text-lg font-bold rounded-xl outline-none transition-all duration-150"
                        style={{
                          background: success
                            ? 'var(--success-light)'
                            : filled
                              ? 'var(--primary-light)'
                              : 'var(--bg-input)',
                          border: success
                            ? '1.5px solid var(--success)'
                            : filled
                              ? '1.5px solid var(--primary)'
                              : isNext
                                ? '1.5px solid color-mix(in srgb, var(--primary) 40%, var(--border))'
                                : '1.5px solid var(--border)',
                          color: 'var(--text-primary)',
                          caretColor: 'transparent',
                        }}
                      />
                      {/* Cursor blink */}
                      {isNext && !loading && (
                        <motion.div
                          className="absolute bottom-2.5 left-1/2 -translate-x-1/2 w-4 h-[2px] rounded-full"
                          style={{ background: 'var(--primary)' }}
                          animate={{ opacity: [1, 0.2, 1] }}
                          transition={{ duration: 1, repeat: Infinity, ease: 'easeInOut' }}
                        />
                      )}
                    </motion.div>
                  );
                })}
              </div>
            </motion.div>

            {/* Toggle visibility */}
            <div className="flex justify-center mt-3.5">
              <button
                onClick={() => setShowPin(p => !p)}
                className="flex items-center gap-1.5 text-[11px] font-medium py-1 px-2.5 rounded-md transition-colors"
                style={{ color: 'var(--text-muted)' }}
                disabled={locked || success}
              >
                {showPin ? <EyeOff className="w-3 h-3" /> : <Eye className="w-3 h-3" />}
                {showPin ? 'Hide' : 'Show'}
              </button>
            </div>
          </div>

          {/* Error / lockout bar */}
          <AnimatePresence>
            {(error || (remainingAttempts !== null && remainingAttempts < 5 && !locked)) && (
              <motion.div
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: 'auto', opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                transition={{ duration: 0.25, ease: [0.22, 1, 0.36, 1] }}
                className="overflow-hidden"
              >
                <div
                  className="flex items-center gap-2.5 px-5 py-3 rounded-xl mt-2"
                  style={{
                    background: locked ? 'var(--danger-light)' : 'var(--warning-light)',
                  }}
                >
                  <AlertCircle className="w-3.5 h-3.5 shrink-0" style={{ color: locked ? 'var(--danger-text)' : 'var(--warning-text)' }} />
                  <div className="flex-1 min-w-0">
                    {error && (
                      <p className="text-[11px] font-medium" style={{ color: locked ? 'var(--danger-text)' : 'var(--warning-text)' }}>
                        {error}
                        {locked && lockoutSeconds > 0 && (
                          <span className="font-mono ml-1.5">{formatLockout(lockoutSeconds)}</span>
                        )}
                      </p>
                    )}
                    {!error && remainingAttempts !== null && remainingAttempts < 5 && (
                      <p className="text-[11px] font-medium" style={{ color: 'var(--warning-text)' }}>
                        {remainingAttempts} attempt{remainingAttempts !== 1 ? 's' : ''} remaining
                      </p>
                    )}
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </motion.div>

        {/* ── System Stats ── */}
        <div
          className="rounded-[28px] border px-5 py-4 md:px-6 md:py-5"
          style={{ background: 'color-mix(in srgb, var(--bg-surface) 72%, transparent)', borderColor: 'var(--border)' }}
        >
          <SystemStats stats={stats} />
        </div>

      </motion.div>
    </div>
  );
}
