'use client';

import { DoorStatus } from '@/lib/types';
import { Card, CardContent } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { Lock, LockOpen, AlertTriangle, WifiOff } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

interface DoorStatusCardProps {
  status: DoorStatus | null;
  isLoading: boolean;
  apiError?: boolean;
  countdown?: number | null;
  autoLockDuration?: number;
}

export function DoorStatusCard({ status, isLoading, apiError, countdown, autoLockDuration = 5 }: DoorStatusCardProps) {
  if (isLoading) {
    return (
      <Card className="h-full">
        <CardContent>
          <div className="flex items-start justify-between">
            <div className="flex-1">
              <div className="h-3 w-24 mb-3 rounded-lg animate-pulse" style={{ background: 'var(--bg-elevated)' }} />
              <div className="h-9 w-36 mb-5 rounded-lg animate-pulse" style={{ background: 'var(--bg-elevated)' }} />
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <div className="h-3 w-24 rounded-lg animate-pulse" style={{ background: 'var(--bg-elevated)' }} />
                  <div className="h-5 w-12 rounded-full animate-pulse" style={{ background: 'var(--bg-elevated)' }} />
                </div>
                <div className="flex items-center justify-between">
                  <div className="h-3 w-28 rounded-lg animate-pulse" style={{ background: 'var(--bg-elevated)' }} />
                  <div className="h-3 w-10 rounded-lg animate-pulse" style={{ background: 'var(--bg-elevated)' }} />
                </div>
              </div>
            </div>
            <div className="w-16 h-16 rounded-2xl ml-4 shrink-0 animate-pulse" style={{ background: 'var(--bg-elevated)' }} />
          </div>
        </CardContent>
      </Card>
    );
  }

  if (apiError || !status) {
    return (
      <Card className="h-full">
        <CardContent>
          <div className="h-48 flex flex-col items-center justify-center gap-4">
            <div
              className="w-16 h-16 rounded-3xl flex items-center justify-center"
              style={{ background: 'var(--danger-light)' }}
            >
              {apiError ? <WifiOff className="w-7 h-7" style={{ color: 'var(--danger)' }} /> : <AlertTriangle className="w-7 h-7" style={{ color: 'var(--danger)' }} />}
            </div>
            <div className="text-center">
              <p className="font-semibold text-[15px]" style={{ color: 'var(--text-primary)' }}>
                {apiError ? 'Cannot Connect to ESP32' : 'Connection Lost'}
              </p>
              <p className="text-[13px] mt-1" style={{ color: 'var(--text-muted)' }}>
                {apiError ? 'Check the device IP and API key in Settings' : 'Cannot reach ESP32 device'}
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    );
  }

  const isLocked = !status.doorUnlocked;
  const stateColors: Record<string, string> = {
    IDLE: 'info',
    AUTH_CHECK: 'warning',
    UNLOCK: 'success',
    REGISTRATION_MODE: 'warning',
    ERROR: 'danger',
  };

  return (
    <Card
      className="h-full"
      style={{
        background: isLocked
          ? 'linear-gradient(135deg, var(--bg-surface) 0%, color-mix(in srgb, var(--danger-light) 40%, var(--bg-surface)) 100%)'
          : 'linear-gradient(135deg, var(--bg-surface) 0%, color-mix(in srgb, var(--primary-light) 30%, var(--bg-surface)) 100%)',
        border: isLocked ? '1px solid color-mix(in srgb, var(--danger) 15%, var(--border))' : '1px solid color-mix(in srgb, var(--primary) 15%, var(--border))',
      }}
    >
      <CardContent>
        <div className="flex items-start justify-between mb-6">
          <div>
            <p className="text-[11px] font-medium tracking-wide uppercase" style={{ color: 'var(--text-muted)' }}>Door Status</p>
            <AnimatePresence mode="wait">
              <motion.div
                key={isLocked ? 'locked' : 'unlocked'}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                transition={{ duration: 0.2 }}
              >
                <p
                  className="text-4xl font-bold mt-2 tracking-tight"
                  style={{ color: 'var(--text-primary)' }}
                >
                  {isLocked ? 'Locked' : 'Unlocked'}
                </p>

              </motion.div>
            </AnimatePresence>
          </div>
          <div className="relative">
            {/* Circular countdown progress ring */}
            {!isLocked && countdown !== null && countdown !== undefined && countdown > 0 && (
              <svg
                className="absolute inset-0 w-16 h-16"
                viewBox="0 0 64 64"
                style={{ transform: 'rotate(-90deg)' }}
              >
                <circle
                  cx="32"
                  cy="32"
                  r="28"
                  fill="none"
                  stroke="color-mix(in srgb, var(--primary) 25%, transparent)"
                  strokeWidth="3"
                />
                <circle
                  cx="32"
                  cy="32"
                  r="28"
                  fill="none"
                  stroke="var(--primary)"
                  strokeWidth="3"
                  strokeLinecap="round"
                  strokeDasharray={`${2 * Math.PI * 28}`}
                  strokeDashoffset={`${2 * Math.PI * 28 * (1 - countdown / autoLockDuration)}`}
                  className="transition-all duration-1000 ease-linear"
                />
              </svg>
            )}
            <div
              className="w-16 h-16 rounded-3xl flex items-center justify-center"
              style={{
                background: isLocked ? 'var(--danger-light)' : 'var(--primary-light)',
                color: isLocked ? 'var(--danger)' : 'var(--primary)',
                boxShadow: isLocked
                  ? '0 0 24px rgba(239, 68, 68, 0.15)'
                  : '0 0 24px rgba(191, 254, 1, 0.15)',
              }}
            >
              <AnimatePresence mode="wait">
                <motion.div
                  key={isLocked ? 'lock-icon' : 'unlock-icon'}
                  initial={{ scale: 0.5, opacity: 0, rotate: -30 }}
                  animate={{ scale: 1, opacity: 1, rotate: 0 }}
                  exit={{ scale: 0.5, opacity: 0, rotate: 30 }}
                  transition={{ duration: 0.25, ease: 'easeOut' }}
                >
                  {isLocked ? <Lock className="w-7 h-7" /> : <LockOpen className="w-7 h-7" />}
                </motion.div>
              </AnimatePresence>
            </div>
          </div>
        </div>

        <div className="space-y-3">
          {/* Auto-lock countdown text when unlocked */}
          <div className="flex items-center justify-between">
            <span className="text-[13px]" style={{ color: 'var(--text-muted)' }}>System State</span>
            <Badge variant={stateColors[status.state] as 'success' | 'danger' | 'warning' | 'info' | 'default'}>
              {status.state.replace(/_/g, ' ')}
            </Badge>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-[13px]" style={{ color: 'var(--text-muted)' }}>Registered Cards</span>
            <span className="text-[13px] font-semibold" style={{ color: 'var(--text-primary)' }}>
              {status.cardCount} / 15
            </span>
          </div>
          {status.lastEvent && (
            <div className="pt-3 mt-1" style={{ borderTop: '1px solid var(--border)' }}>
              <p className="text-xs font-medium" style={{ color: 'var(--text-muted)' }}>Last Event</p>
              <p className="text-[13px] mt-1" style={{ color: 'var(--text-secondary)' }}>{status.lastEvent}</p>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
