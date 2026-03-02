'use client';

import { useState, useEffect, useRef } from 'react';
import { Button } from '@/components/ui/Button';
import { Shield, LogOut, Check, AlertCircle, Eye, EyeOff, KeyRound } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import toast from 'react-hot-toast';

/** 6-digit PIN input row */
function PinInput({
  value,
  onChange,
  disabled,
  showPin,
  autoFocus,
  label,
}: {
  value: string;
  onChange: (v: string) => void;
  disabled?: boolean;
  showPin: boolean;
  autoFocus?: boolean;
  label: string;
}) {
  const inputRefs = useRef<(HTMLInputElement | null)[]>([]);

  const handleInput = (index: number, char: string) => {
    if (!/^\d$/.test(char)) return;
    const next = value.slice(0, index) + char + value.slice(index + 1);
    onChange(next.slice(0, 6));
    if (index < 5) inputRefs.current[index + 1]?.focus();
  };

  const handleKeyDown = (index: number, e: React.KeyboardEvent) => {
    if (e.key === 'Backspace') {
      e.preventDefault();
      if (value[index]) {
        const next = value.slice(0, index) + value.slice(index + 1);
        onChange(next);
      } else if (index > 0) {
        inputRefs.current[index - 1]?.focus();
        const next = value.slice(0, index - 1) + value.slice(index);
        onChange(next);
      }
    }
  };

  const handlePaste = (e: React.ClipboardEvent) => {
    e.preventDefault();
    const pasted = e.clipboardData.getData('text').replace(/\D/g, '').slice(0, 6);
    if (pasted) {
      onChange(pasted);
      const focusIdx = Math.min(pasted.length, 5);
      inputRefs.current[focusIdx]?.focus();
    }
  };

  return (
    <div>
      <label className="block text-[11px] font-medium mb-1.5" style={{ color: 'var(--text-muted)' }}>
        {label}
      </label>
      <div className="flex gap-1.5">
        {Array.from({ length: 6 }).map((_, i) => (
          <input
            key={i}
            ref={(el) => { inputRefs.current[i] = el; }}
            type={showPin ? 'text' : 'password'}
            inputMode="numeric"
            maxLength={1}
            value={value[i] || ''}
            disabled={disabled}
            autoFocus={autoFocus && i === 0}
            className="w-9 h-10 text-center text-sm font-semibold rounded-lg outline-none transition-all"
            style={{
              background: 'var(--bg-input)',
              border: '1px solid var(--border)',
              color: 'var(--text-primary)',
            }}
            onFocus={(e) => {
              e.currentTarget.style.borderColor = 'var(--primary)';
              e.currentTarget.style.boxShadow = '0 0 0 2px color-mix(in srgb, var(--primary) 20%, transparent)';
            }}
            onBlur={(e) => {
              e.currentTarget.style.borderColor = 'var(--border)';
              e.currentTarget.style.boxShadow = 'none';
            }}
            onInput={(e) => handleInput(i, (e.target as HTMLInputElement).value.slice(-1))}
            onKeyDown={(e) => handleKeyDown(i, e)}
            onPaste={handlePaste}
          />
        ))}
      </div>
    </div>
  );
}

export function SecuritySettings() {
  const [pinConfigured, setPinConfigured] = useState<boolean | null>(null);
  const [loading, setLoading] = useState(false);
  const [showPin, setShowPin] = useState(false);
  const [loggingOut, setLoggingOut] = useState(false);

  const [newPin, setNewPin] = useState('');
  const [currentPin, setCurrentPin] = useState('');
  const [changePin, setChangePin] = useState('');
  const [success, setSuccess] = useState(false);

  useEffect(() => {
    checkPinStatus();
  }, []);

  const checkPinStatus = async () => {
    try {
      const res = await fetch('/api/auth/check');
      const data = await res.json();
      setPinConfigured(data.configured);
    } catch {
      setPinConfigured(false);
    }
  };

  const handleSetPin = async () => {
    if (newPin.length !== 6) {
      toast.error('PIN must be exactly 6 digits');
      return;
    }
    setLoading(true);
    try {
      const res = await fetch('/api/auth/pin', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ pin: newPin }),
      });
      const data = await res.json();
      if (data.success) {
        setSuccess(true);
        toast.success('PIN set successfully');
        setNewPin('');
        setPinConfigured(true);
        setTimeout(() => setSuccess(false), 2000);
      } else {
        toast.error(data.message || 'Failed to set PIN');
      }
    } catch {
      toast.error('Failed to set PIN');
    } finally {
      setLoading(false);
    }
  };

  const handleChangePin = async () => {
    if (currentPin.length !== 6) {
      toast.error('Enter your current 6-digit PIN');
      return;
    }
    if (changePin.length !== 6) {
      toast.error('New PIN must be exactly 6 digits');
      return;
    }
    if (currentPin === changePin) {
      toast.error('New PIN must be different from current');
      return;
    }
    setLoading(true);
    try {
      const res = await fetch('/api/auth/pin', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ currentPin, newPin: changePin }),
      });
      const data = await res.json();
      if (data.success) {
        setSuccess(true);
        toast.success('PIN changed successfully');
        setCurrentPin('');
        setChangePin('');
        setTimeout(() => setSuccess(false), 2000);
      } else {
        toast.error(data.message || 'Failed to change PIN');
      }
    } catch {
      toast.error('Failed to change PIN');
    } finally {
      setLoading(false);
    }
  };

  const handleLogout = async () => {
    setLoggingOut(true);
    try {
      await fetch('/api/auth/logout', { method: 'POST' });
      // Hard navigation to clear Next.js Router Cache completely
      // router.push would keep cached RSC payloads, allowing bypass
      window.location.href = '/login';
    } catch {
      toast.error('Failed to logout');
      setLoggingOut(false);
    }
  };

  if (pinConfigured === null) {
    return (
      <div
        className="rounded-xl flex items-center justify-center py-5"
        style={{ background: 'var(--bg-surface)', border: '1px solid var(--border)' }}
      >
        <div
          className="w-5 h-5 rounded-full border-2 border-t-transparent animate-spin"
          style={{ borderColor: 'var(--border-strong)', borderTopColor: 'transparent' }}
        />
      </div>
    );
  }

  return (
    <div className="rounded-xl overflow-hidden" style={{ border: '1px solid var(--border)' }}>
      {/* PIN section */}
      <div className="px-3 py-3" style={{ background: 'var(--bg-surface)' }}>
        <div className="flex items-center gap-3 mb-3">
          <div
            className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0"
            style={{ background: 'var(--primary-light)' }}
          >
            <Shield className="w-4 h-4" style={{ color: 'var(--primary)' }} />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-[13px] font-semibold" style={{ color: 'var(--text-primary)' }}>
              {pinConfigured ? 'Change PIN' : 'Set PIN'}
            </p>
            <p className="text-[10px]" style={{ color: 'var(--text-muted)' }}>
              {pinConfigured ? '6-digit access PIN' : 'Protect the dashboard with a PIN'}
            </p>
          </div>
          <button
            onClick={() => setShowPin(!showPin)}
            className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0 transition-colors"
            style={{ background: 'var(--bg-surface-hover)', color: 'var(--text-muted)' }}
          >
            {showPin ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
          </button>
        </div>

        <AnimatePresence mode="wait">
          {success ? (
            <motion.div
              key="success"
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.9 }}
              className="flex items-center justify-center gap-2 py-3"
            >
              <div
                className="w-7 h-7 rounded-full flex items-center justify-center"
                style={{ background: 'var(--success-light)' }}
              >
                <Check className="w-3.5 h-3.5" style={{ color: 'var(--success-text)' }} />
              </div>
              <span className="text-[12px] font-medium" style={{ color: 'var(--success-text)' }}>
                {pinConfigured ? 'PIN updated' : 'PIN set'}
              </span>
            </motion.div>
          ) : !pinConfigured ? (
            <motion.div
              key="setup"
              initial={{ opacity: 0, y: 5 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -5 }}
              className="space-y-2.5"
            >
              <div
                className="flex items-start gap-2 px-2.5 py-2 rounded-lg text-[10px]"
                style={{
                  background: 'color-mix(in srgb, var(--primary) 8%, transparent)',
                  border: '1px solid color-mix(in srgb, var(--primary) 20%, transparent)',
                }}
              >
                <AlertCircle className="w-3 h-3 shrink-0 mt-0.5" style={{ color: 'var(--primary)' }} />
                <span style={{ color: 'var(--text-secondary)' }}>No PIN configured yet.</span>
              </div>

              <PinInput value={newPin} onChange={setNewPin} disabled={loading} showPin={showPin} autoFocus={false} label="New PIN" />

              <Button onClick={handleSetPin} isLoading={loading} disabled={newPin.length !== 6} size="sm" className="w-full">
                <KeyRound className="w-3.5 h-3.5 mr-1.5" />
                Set PIN
              </Button>
            </motion.div>
          ) : (
            <motion.div
              key="change"
              initial={{ opacity: 0, y: 5 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -5 }}
              className="space-y-2.5"
            >
              <PinInput value={currentPin} onChange={setCurrentPin} disabled={loading} showPin={showPin} label="Current PIN" />
              <PinInput value={changePin} onChange={setChangePin} disabled={loading} showPin={showPin} label="New PIN" />

              <Button
                onClick={handleChangePin}
                isLoading={loading}
                disabled={currentPin.length !== 6 || changePin.length !== 6}
                variant="secondary"
                size="sm"
                className="w-full"
              >
                <KeyRound className="w-3.5 h-3.5 mr-1.5" />
                Change PIN
              </Button>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Logout row */}
      {pinConfigured && (
        <>
          <div style={{ height: 1, background: 'var(--border)' }} />
          <div
            className="px-3 py-2.5 flex items-center gap-3"
            style={{ background: 'var(--bg-surface)' }}
          >
            <div
              className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0"
              style={{ background: 'var(--danger-light)' }}
            >
              <LogOut className="w-4 h-4" style={{ color: 'var(--danger)' }} />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-[13px] font-semibold" style={{ color: 'var(--text-primary)' }}>Sign Out</p>
              <p className="text-[10px]" style={{ color: 'var(--text-muted)' }}>End session &amp; return to login</p>
            </div>
            <Button onClick={handleLogout} isLoading={loggingOut} variant="secondary" size="sm" className="text-[11px] !px-2.5 !py-1.5">
              <LogOut className="w-3 h-3 mr-1" />
              Logout
            </Button>
          </div>
        </>
      )}
    </div>
  );
}
