'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { AccessLog } from '@/lib/types';
import { dashboardEvents } from '@/lib/dashboardEvents';

/**
 * Hook for fetching access logs — MQTT event-driven.
 * - Fetches initial data once on mount (full load)
 * - Listens for 'log-added' dashboardEvent (emitted when MQTT access_log arrives)
 *   and does an incremental fetch for new logs
 * - Refreshes on tab visibility change
 * - Subscribes to card-renamed/cards-changed for nickname updates
 *
 * No polling — MQTT provides real-time triggers.
 */
export function useServerLogs() {
  const [logs, setLogs] = useState<AccessLog[]>([]);
  const [totalCount, setTotalCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const latestTimestampRef = useRef<string | null>(null);

  // Fetch all logs from database (full load)
  const fetchLogs = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const response = await fetch('/api/logs');

      if (!response.ok) {
        throw new Error('Failed to fetch logs');
      }

      const data = await response.json();
      // New format: { logs: [...], totalCount: N }
      const logEntries: AccessLog[] = data.logs || data;
      const count: number = data.totalCount ?? logEntries.length;
      setLogs(logEntries);
      setTotalCount(count);

      // Track the most recent timestamp for incremental fetches
      if (logEntries.length > 0) {
        latestTimestampRef.current = logEntries[0].timestamp;
      }
    } catch (err) {
      console.error('Error fetching logs:', err);
      setError(err instanceof Error ? err.message : 'Failed to fetch logs');
    } finally {
      setLoading(false);
    }
  }, []);

  // Incremental fetch — only get logs newer than the last one we have
  const fetchNewLogs = useCallback(async () => {
    if (!latestTimestampRef.current) return;

    try {
      const since = encodeURIComponent(latestTimestampRef.current);
      const response = await fetch(`/api/logs?since=${since}`);

      if (!response.ok) return;

      const newLogs: AccessLog[] = await response.json();

      if (newLogs.length > 0) {
        latestTimestampRef.current = newLogs[0].timestamp;
        setLogs((prev) => [...newLogs, ...prev]);
        setTotalCount((prev) => prev + newLogs.length);
      }
    } catch {
      // Silent fail — will be triggered again on next MQTT event
    }
  }, []);

  // Tab visibility — refresh on focus
  useEffect(() => {
    const handleVisibility = () => {
      if (document.visibilityState === 'visible') {
        fetchNewLogs();
      }
    };
    document.addEventListener('visibilitychange', handleVisibility);
    return () => document.removeEventListener('visibilitychange', handleVisibility);
  }, [fetchNewLogs]);

  useEffect(() => {
    // 1. Fetch initial data
    fetchLogs();

    // 2. Subscribe to MQTT-triggered log events (real-time)
    const u0 = dashboardEvents.on('log-added', () => {
      // Small delay to let server-side MQTT handler save to DB first
      setTimeout(fetchNewLogs, 500);
    });

    // 3. Subscribe to card changes to refresh nicknames
    const u1 = dashboardEvents.on('card-renamed', fetchLogs);
    const u2 = dashboardEvents.on('cards-changed', fetchLogs);

    return () => {
      u0();
      u1();
      u2();
    };
  }, [fetchLogs, fetchNewLogs]);

  const refreshLogs = useCallback(() => {
    fetchLogs();
  }, [fetchLogs]);

  return {
    logs,
    totalCount,
    loading,
    error,
    refreshLogs,
  };
}
