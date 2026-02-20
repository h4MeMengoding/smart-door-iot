'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { DoorStatus, Card as CardType, AccessLog } from '@/lib/types';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/Card';
import { CreditCard, Clock, Globe, Fingerprint } from 'lucide-react';
import { formatUid, formatRelativeTime } from '@/lib/utils';
import { dashboardEvents } from '@/lib/dashboardEvents';

interface LastAccessCardProps {
  status: DoorStatus | null;
}

type AccessSource = 'RFID' | 'WEB' | 'TOUCH' | 'UNKNOWN';

export function LastAccessCard({ status }: LastAccessCardProps) {
  const [lastLog, setLastLog] = useState<AccessLog | null>(null);
  const [, setTick] = useState(0);
  const fetchingRef = useRef(false);

  const fetchLastLog = useCallback(async () => {
    if (fetchingRef.current) return;
    fetchingRef.current = true;
    try {
      const response = await fetch('/api/logs');
      if (!response.ok) return;
      const logs: AccessLog[] = await response.json();
      if (logs.length > 0) {
        setLastLog(logs[0]); // Already sorted desc by createdAt
      }
    } catch {
      // Silently fail
    } finally {
      fetchingRef.current = false;
    }
  }, []);

  // Fetch on mount
  useEffect(() => {
    fetchLastLog();
  }, [fetchLastLog]);

  // Refetch when new logs are added or door status changes
  useEffect(() => {
    const unsub1 = dashboardEvents.on('log-added', () => {
      // Small delay to let DB write complete
      setTimeout(fetchLastLog, 500);
    });
    return () => { unsub1(); };
  }, [fetchLastLog]);

  // Refetch when door status lastEvent changes (new unlock/lock)
  const prevEventRef = useRef<string | null>(null);
  useEffect(() => {
    const currentEvent = status?.lastEvent || null;
    if (currentEvent && currentEvent !== prevEventRef.current && currentEvent !== 'System ready') {
      // Delay to let the log POST complete
      setTimeout(fetchLastLog, 1000);
    }
    prevEventRef.current = currentEvent;
  }, [status?.lastEvent, fetchLastLog]);

  // Tick every 10s to update relative time display
  useEffect(() => {
    if (!lastLog) return;
    const interval = setInterval(() => setTick(t => t + 1), 10000);
    return () => clearInterval(interval);
  }, [lastLog]);

  // Derive source from last log
  const source: AccessSource = lastLog?.accessType as AccessSource || 'UNKNOWN';
  const hasAccess = !!lastLog;

  // Source-specific icon
  const SourceIcon = source === 'WEB' ? Globe : source === 'TOUCH' ? Fingerprint : CreditCard;

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center gap-2">
          <div
            className="w-8 h-8 rounded-xl flex items-center justify-center"
            style={{ background: 'var(--primary-light)' }}
          >
            <SourceIcon className="w-4 h-4" style={{ color: 'var(--primary)' }} />
          </div>
          <div>
            <CardTitle>Last Access</CardTitle>
            <CardDescription>Most recent entry event</CardDescription>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        {hasAccess ? (
          <div className="space-y-3.5">
            <div>
              {source === 'WEB' ? (
                <>
                  <p className="text-xs mb-1" style={{ color: 'var(--text-muted)' }}>Access Source</p>
                  <p className="text-xl font-bold tracking-tight" style={{ color: 'var(--text-primary)' }}>
                    Web Dashboard
                  </p>
                  <p className="text-xs mt-1" style={{ color: 'var(--text-muted)' }}>
                    Remote unlock via browser
                  </p>
                </>
              ) : source === 'TOUCH' ? (
                <>
                  <p className="text-xs mb-1" style={{ color: 'var(--text-muted)' }}>Access Source</p>
                  <p className="text-xl font-bold tracking-tight" style={{ color: 'var(--text-primary)' }}>
                    Touch Sensor
                  </p>
                  <p className="text-xs mt-1" style={{ color: 'var(--text-muted)' }}>
                    Physical touch exit
                  </p>
                </>
              ) : lastLog?.cardUid ? (
                <>
                  <p className="text-xs mb-1" style={{ color: 'var(--text-muted)' }}>Card Name</p>
                  <p className="text-xl font-bold tracking-tight" style={{ color: 'var(--text-primary)' }}>
                    {lastLog.cardNickname || formatUid(lastLog.cardUid)}
                  </p>
                  {lastLog.cardNickname && (
                    <p className="text-xs font-mono mt-1" style={{ color: 'var(--text-muted)' }}>
                      {formatUid(lastLog.cardUid)}
                    </p>
                  )}
                </>
              ) : (
                <>
                  <p className="text-xs mb-1" style={{ color: 'var(--text-muted)' }}>Event</p>
                  <p className="text-lg font-semibold" style={{ color: 'var(--text-primary)' }}>
                    {lastLog?.action === 'unlock' ? 'Door Unlocked' : 'Access Denied'}
                  </p>
                </>
              )}
            </div>
            <div className="flex items-center gap-2 text-[13px]" style={{ color: 'var(--text-muted)' }}>
              <Clock className="w-3.5 h-3.5" />
              <span>{lastLog?.timestamp ? formatRelativeTime(lastLog.timestamp) : 'Just now'}</span>
            </div>
            {lastLog && (
              <div className="pt-3.5" style={{ borderTop: '1px solid var(--border)' }}>
                <p className="text-xs font-medium" style={{ color: 'var(--text-muted)' }}>Action</p>
                <p className="text-[13px] mt-1" style={{ color: 'var(--text-secondary)' }}>
                  {lastLog.success ? 'Access granted' : 'Access denied'} — {source}
                </p>
              </div>
            )}
          </div>
        ) : (
          <div className="text-center py-4">
            <div
              className="w-12 h-12 rounded-2xl mx-auto mb-3 flex items-center justify-center"
              style={{ background: 'var(--bg-surface-hover)' }}
            >
              <CreditCard className="w-5 h-5" style={{ color: 'var(--border-strong)' }} />
            </div>
            <p className="text-[13px] font-medium" style={{ color: 'var(--text-muted)' }}>No recent access</p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
