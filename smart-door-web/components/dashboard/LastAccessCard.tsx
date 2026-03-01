'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { DoorStatus, AccessLog } from '@/lib/types';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/Card';
import { CreditCard, Clock, Globe, Fingerprint } from 'lucide-react';
import { formatUid, formatRelativeTime } from '@/lib/utils';
import { dashboardEvents } from '@/lib/dashboardEvents';
import { useMediaQuery } from '@/hooks/useMediaQuery';

interface LastAccessCardProps {
  status: DoorStatus | null;
}

type AccessSource = 'RFID' | 'WEB' | 'TOUCH' | 'UNKNOWN';

export function LastAccessCard({ status }: LastAccessCardProps) {
  const isMobile = useMediaQuery('(max-width: 768px)');
  const [lastLog, setLastLog] = useState<AccessLog | null>(null);
  const [, setTick] = useState(0);

  const fetchLastLog = useCallback(async (signal?: AbortSignal) => {
    try {
      const response = await fetch('/api/logs?limit=1', { signal });
      if (!response.ok) return;
      const data = await response.json();
      // API returns { logs: [...], totalCount } for initial loads
      const logs: AccessLog[] = data.logs ?? data;
      if (logs.length > 0) {
        setLastLog(logs[0]);
      }
    } catch (err) {
      if ((err as Error)?.name === 'AbortError') return;
      // Silently fail for other errors
    }
  }, []);

  // Fetch on mount — use AbortController so StrictMode double-invoke cleans up safely
  useEffect(() => {
    const controller = new AbortController();
    fetchLastLog(controller.signal);
    return () => controller.abort();
  }, [fetchLastLog]);

  // Refetch when new logs are added or door status changes
  useEffect(() => {
    const unsub1 = dashboardEvents.on('log-added', () => {
      // Small delay to let DB write complete
      setTimeout(() => fetchLastLog(), 500);
    });
    return () => { unsub1(); };
  }, [fetchLastLog]);

  // Refetch when door status lastEvent changes (new unlock/lock)
  const prevEventRef = useRef<string | null>(null);
  useEffect(() => {
    const currentEvent = status?.lastEvent || null;
    if (currentEvent && currentEvent !== prevEventRef.current && currentEvent !== 'System ready') {
      // Delay to let the log POST complete
      setTimeout(() => fetchLastLog(), 1000);
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
            {isMobile && <CardDescription>Recent entry event</CardDescription>}
          </div>
        </div>
      </CardHeader>
      <CardContent>
        {hasAccess ? (
          <div className="space-y-3.5">
            <div>
              <p className="text-xs mb-1" style={{ color: 'var(--text-muted)' }}>Access Source</p>
              <p className="text-xl font-bold tracking-tight" style={{ color: 'var(--text-primary)' }}>
                {source === 'WEB' ? 'Web Dashboard' : source === 'TOUCH' ? 'Touch Sensor' : lastLog?.cardNickname || formatUid(lastLog?.cardUid || '')}
              </p>
              {lastLog?.action === 'unlock' ? (
                <p className="text-lg font-semibold mt-1" style={{ color: 'var(--success)' }}>OK</p>
              ) : (
                <p className="text-lg font-semibold mt-1" style={{ color: 'var(--danger)' }}>DENY</p>
              )}
            </div>
            <div className="flex items-center gap-2 text-[13px]" style={{ color: 'var(--text-muted)' }}>
              <Clock className="w-3.5 h-3.5" />
              <span>{lastLog?.timestamp ? formatRelativeTime(lastLog.timestamp) : 'Just now'}</span>
            </div>
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
