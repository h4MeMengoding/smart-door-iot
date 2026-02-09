'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import { Shield, AlertTriangle, Lock, Eye, EyeOff } from 'lucide-react';

const PIN_LENGTH = 6;
const MAX_DISPLAY_ATTEMPTS = 5;

export default function LoginPage() {
  const [digits, setDigits] = useState<string[]>(Array(PIN_LENGTH).fill(''));
  const [activeIndex, setActiveIndex] = useState(0);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [remainingAttempts, setRemainingAttempts] = useState<number | null>(null);
  const [lockoutSeconds, setLockoutSeconds] = useState(0);
  const [showDigits, setShowDigits] = useState(false);
  const [shake, setShake] = useState(false);
  const inputRefs = useRef<(HTMLInputElement | null)[]>([]);
  const router = useRouter();

  // Auto-focus first input on mount
  useEffect(() => {
    setTimeout(() => inputRefs.current[0]?.focus(), 100);
  }, []);

  // Lockout countdown
  useEffect(() => {
    if (lockoutSeconds <= 0) return;
    const timer = setInterval(() => {
      setLockoutSeconds(prev => {
        if (prev <= 1) {
          setError(null);
          setRemainingAttempts(MAX_DISPLAY_ATTEMPTS);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(timer);
  }, [lockoutSeconds]);

  const triggerShake = () => {
    setShake(true);
    setTimeout(() => setShake(false), 600);
  };

  const resetDigits = () => {
    setDigits(Array(PIN_LENGTH).fill(''));
    setActiveIndex(0);
    setTimeout(() => inputRefs.current[0]?.focus(), 50);
  };

  const submitPin = useCallback(async (pin: string) => {
    if (isSubmitting || lockoutSeconds > 0) return;

    setIsSubmitting(true);
    setError(null);

    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ pin }),
      });

      const data = await res.json();

      if (res.ok && data.success) {
        router.push('/');
        router.refresh();
      } else {
        triggerShake();
        setError(data.message || 'Invalid code');
        setRemainingAttempts(data.remainingAttempts ?? null);

        if (res.status === 429 && data.retryAfter) {
          setLockoutSeconds(data.retryAfter);
        }

        resetDigits();
      }
    } catch {
      triggerShake();
      setError('Connection error');
      resetDigits();
    } finally {
      setIsSubmitting(false);
    }
  }, [isSubmitting, lockoutSeconds, router]);

  const handleDigitChange = (index: number, value: string) => {
    if (lockoutSeconds > 0) return;

    const digit = value.replace(/\D/g, '').slice(-1);

    const newDigits = [...digits];
    newDigits[index] = digit;
    setDigits(newDigits);

    if (digit && index < PIN_LENGTH - 1) {
      setActiveIndex(index + 1);
      inputRefs.current[index + 1]?.focus();
    }

    if (digit && index === PIN_LENGTH - 1) {
      const pin = newDigits.join('');
      if (pin.length === PIN_LENGTH) {
        submitPin(pin);
      }
    }
  };

  const handleKeyDown = (index: number, e: React.KeyboardEvent) => {
    if (lockoutSeconds > 0) return;

    if (e.key === 'Backspace') {
      e.preventDefault();
      const newDigits = [...digits];

      if (digits[index]) {
        newDigits[index] = '';
        setDigits(newDigits);
      } else if (index > 0) {
        newDigits[index - 1] = '';
        setDigits(newDigits);
        setActiveIndex(index - 1);
        inputRefs.current[index - 1]?.focus();
      }
    } else if (e.key === 'ArrowLeft' && index > 0) {
      setActiveIndex(index - 1);
      inputRefs.current[index - 1]?.focus();
    } else if (e.key === 'ArrowRight' && index < PIN_LENGTH - 1) {
      setActiveIndex(index + 1);
      inputRefs.current[index + 1]?.focus();
    } else if (e.key === 'Enter') {
      const pin = digits.join('');
      if (pin.length === PIN_LENGTH) {
        submitPin(pin);
      }
    }
  };

  const handlePaste = (e: React.ClipboardEvent) => {
    e.preventDefault();
    if (lockoutSeconds > 0) return;

    const pasted = e.clipboardData.getData('text').replace(/\D/g, '').slice(0, PIN_LENGTH);
    if (!pasted) return;

    const newDigits = Array(PIN_LENGTH).fill('');
    for (let i = 0; i < pasted.length; i++) {
      newDigits[i] = pasted[i];
    }
    setDigits(newDigits);

    const nextIndex = Math.min(pasted.length, PIN_LENGTH - 1);
    setActiveIndex(nextIndex);
    inputRefs.current[nextIndex]?.focus();

    if (pasted.length === PIN_LENGTH) {
      submitPin(pasted);
    }
  };

  const formatLockout = (seconds: number) => {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m}:${s.toString().padStart(2, '0')}`;
  };

  const isLocked = lockoutSeconds > 0;

  return (
    <div className="fixed inset-0 flex items-center justify-center overflow-hidden" style={{ background: 'var(--bg-base)' }}>
      {/* Background glows */}
      <div className="glow glow-1" />
      <div className="glow glow-2" />
      <div className="glow glow-3" />

      <motion.div
        initial={{ opacity: 0, y: 20, scale: 0.98 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ duration: 0.5, ease: [0.25, 0.46, 0.45, 0.94] }}
        className="relative z-10 w-full max-w-95 mx-4"
      >
        {/* Card */}
        <div
          className="rounded-3xl p-8 backdrop-blur-xl"
          style={{
            background: 'color-mix(in srgb, var(--bg-surface) 80%, transparent)',
            border: '1px solid var(--border)',
            boxShadow: '0 24px 48px -12px rgba(0, 0, 0, 0.25), 0 0 0 1px color-mix(in srgb, var(--primary) 5%, transparent)',
          }}
        >
          {/* Icon + Branding */}
          <motion.div
            className="flex flex-col items-center mb-8"
            initial={{ scale: 0, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ delay: 0.15, type: 'spring', stiffness: 200, damping: 15 }}
          >
            <div
              className="w-16 h-16 rounded-2xl flex items-center justify-center mb-4"
              style={{
                background: isLocked
                  ? 'linear-gradient(135deg, var(--danger-light) 0%, color-mix(in srgb, var(--danger) 15%, transparent) 100%)'
                  : 'linear-gradient(135deg, var(--primary-light) 0%, color-mix(in srgb, var(--primary) 15%, transparent) 100%)',
                boxShadow: isLocked
                  ? '0 0 40px rgba(239, 68, 68, 0.12)'
                  : '0 0 40px rgba(191, 254, 1, 0.12)',
              }}
            >
              <AnimatePresence mode="wait">
                <motion.div
                  key={isLocked ? 'locked' : 'shield'}
                  initial={{ scale: 0.5, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  exit={{ scale: 0.5, opacity: 0 }}
                  transition={{ duration: 0.2 }}
                >
                  {isLocked ? (
                    <Lock className="w-7 h-7" style={{ color: 'var(--danger)' }} />
                  ) : (
                    <Shield className="w-7 h-7" style={{ color: 'var(--primary)' }} />
                  )}
                </motion.div>
              </AnimatePresence>
            </div>
            <h1
              className="text-lg font-bold tracking-tight"
              style={{ color: 'var(--text-primary)' }}
            >
              Smart Door Lock
            </h1>
            <p
              className="text-xs mt-1 font-medium"
              style={{ color: 'var(--text-muted)' }}
            >
              {isLocked ? `Locked — retry in ${formatLockout(lockoutSeconds)}` : 'Enter your access code'}
            </p>
          </motion.div>

          {/* PIN Input Boxes */}
          <motion.div
            className="flex justify-center gap-2.5 mb-6"
            animate={shake ? { x: [0, -12, 12, -8, 8, -4, 4, 0] } : {}}
            transition={{ duration: 0.5 }}
          >
            {digits.map((digit, i) => (
              <motion.div
                key={i}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.25 + i * 0.04 }}
                className="relative"
              >
                <input
                  ref={(el) => { inputRefs.current[i] = el; }}
                  type={showDigits ? 'text' : 'password'}
                  inputMode="numeric"
                  maxLength={1}
                  value={digit}
                  onChange={(e) => handleDigitChange(i, e.target.value)}
                  onKeyDown={(e) => handleKeyDown(i, e)}
                  onPaste={i === 0 ? handlePaste : undefined}
                  onFocus={() => setActiveIndex(i)}
                  disabled={isLocked || isSubmitting}
                  autoComplete="off"
                  className="w-12 h-14 text-center text-xl font-bold rounded-xl outline-none transition-all duration-200"
                  style={{
                    background: isLocked
                      ? 'var(--bg-surface-hover)'
                      : digit
                        ? 'color-mix(in srgb, var(--primary) 8%, var(--bg-surface))'
                        : 'var(--bg-input)',
                    border: activeIndex === i && !isLocked
                      ? '2px solid var(--primary)'
                      : digit
                        ? '2px solid color-mix(in srgb, var(--primary) 30%, var(--border))'
                        : '2px solid var(--border)',
                    color: 'var(--text-primary)',
                    opacity: isLocked ? 0.5 : 1,
                    caretColor: 'transparent',
                    boxShadow: activeIndex === i && !isLocked
                      ? '0 0 0 3px color-mix(in srgb, var(--primary) 12%, transparent)'
                      : 'none',
                  }}
                />
                {/* Filled indicator dot */}
                {digit && !showDigits && (
                  <motion.div
                    initial={{ scale: 0 }}
                    animate={{ scale: 1 }}
                    className="absolute inset-0 flex items-center justify-center pointer-events-none"
                  >
                    <div
                      className="w-3 h-3 rounded-full"
                      style={{ background: 'var(--text-primary)' }}
                    />
                  </motion.div>
                )}
              </motion.div>
            ))}
          </motion.div>

          {/* Show/Hide toggle */}
          <div className="flex justify-center mb-5">
            <button
              onClick={() => setShowDigits(!showDigits)}
              disabled={isLocked}
              className="flex items-center gap-1.5 text-xs font-medium transition-colors px-3 py-1.5 rounded-lg"
              style={{ color: 'var(--text-muted)' }}
              onMouseEnter={(e) => { e.currentTarget.style.background = 'var(--bg-surface-hover)'; }}
              onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; }}
            >
              {showDigits ? (
                <>
                  <EyeOff className="w-3.5 h-3.5" />
                  Hide
                </>
              ) : (
                <>
                  <Eye className="w-3.5 h-3.5" />
                  Show
                </>
              )}
            </button>
          </div>

          {/* Error message */}
          <AnimatePresence>
            {error && (
              <motion.div
                initial={{ opacity: 0, y: -5, height: 0 }}
                animate={{ opacity: 1, y: 0, height: 'auto' }}
                exit={{ opacity: 0, y: -5, height: 0 }}
                className="flex items-center justify-center gap-2 py-3 px-4 rounded-xl mb-4"
                style={{
                  background: 'var(--danger-light)',
                  border: '1px solid color-mix(in srgb, var(--danger) 20%, transparent)',
                }}
              >
                <AlertTriangle className="w-3.5 h-3.5 shrink-0" style={{ color: 'var(--danger)' }} />
                <span className="text-xs font-medium" style={{ color: 'var(--danger-text)' }}>
                  {error}
                </span>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Remaining attempts */}
          {remainingAttempts !== null && remainingAttempts < MAX_DISPLAY_ATTEMPTS && remainingAttempts > 0 && !isLocked && (
            <motion.p
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="text-center text-xs"
              style={{ color: 'var(--text-muted)' }}
            >
              {remainingAttempts} attempt{remainingAttempts !== 1 ? 's' : ''} remaining
            </motion.p>
          )}

          {/* Loading indicator */}
          {isSubmitting && (
            <div className="flex justify-center mt-4">
              <div
                className="w-5 h-5 border-2 border-t-transparent rounded-full animate-spin"
                style={{ borderColor: 'var(--primary)', borderTopColor: 'transparent' }}
              />
            </div>
          )}
        </div>

        {/* Footer */}
        <motion.p
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.6 }}
          className="text-center text-[11px] mt-4 font-medium"
          style={{ color: 'color-mix(in srgb, var(--text-muted) 60%, transparent)' }}
        >
          Smart Door IoT System
        </motion.p>
      </motion.div>
    </div>
  );
}
