'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { AccessLog } from '@/lib/types';
import { dashboardEvents } from '@/lib/dashboardEvents';

/**
 * Hook untuk mengambil access logs secara realtime via efficient polling.
 * - Fetch initial data sekali saat mount (full load)
 * - Poll setiap 3 detik untuk logs baru (incremental via ?since=timestamp)
 * - Auto-pause saat tab/window tidak visible (hemat invocations)
 * 
 * Menggantikan SSE yang 100% error di Vercel Free karena 10s timeout.
 * Dashboard tetap realtime via WebSocket (ESP32 → browser langsung),
 * polling ini hanya menjaga log list tetap sinkron dengan database.
 */
export function useServerLogs() {
  const [logs, setLogs] = useState<AccessLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const pollIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const latestTimestampRef = useRef<string | null>(null);
  const isPollingSuspendedRef = useRef(false);

  // Fetch semua logs dari database (full load)
  const fetchLogs = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const response = await fetch('/api/logs');

      if (!response.ok) {
        throw new Error('Failed to fetch logs');
      }

      const data: AccessLog[] = await response.json();
      setLogs(data);

      // Track the most recent timestamp for incremental polling
      if (data.length > 0) {
        latestTimestampRef.current = data[0].timestamp;
      }
    } catch (err) {
      console.error('Error fetching logs:', err);
      setError(err instanceof Error ? err.message : 'Failed to fetch logs');
    } finally {
      setLoading(false);
    }
  }, []);

  // Incremental poll — hanya ambil logs baru sejak terakhir diterima
  const pollNewLogs = useCallback(async () => {
    if (isPollingSuspendedRef.current) return;
    if (!latestTimestampRef.current) return;

    try {
      const since = encodeURIComponent(latestTimestampRef.current);
      const response = await fetch(`/api/logs?since=${since}`);

      if (!response.ok) return; // Silent fail for polls

      const newLogs: AccessLog[] = await response.json();

      if (newLogs.length > 0) {
        // Update latest timestamp
        latestTimestampRef.current = newLogs[0].timestamp;
        // Prepend new logs (they're already sorted desc by server)
        setLogs((prev) => [...newLogs, ...prev]);
      }
    } catch {
      // Silent fail for incremental polls — next poll will retry
    }
  }, []);

  // Visibility-based polling pause/resume
  useEffect(() => {
    const handleVisibility = () => {
      if (document.hidden) {
        isPollingSuspendedRef.current = true;
      } else {
        isPollingSuspendedRef.current = false;
        // Fetch any missed logs when tab becomes visible again
        pollNewLogs();
      }
    };

    document.addEventListener('visibilitychange', handleVisibility);
    return () => document.removeEventListener('visibilitychange', handleVisibility);
  }, [pollNewLogs]);

  useEffect(() => {
    // 1. Fetch initial data
    fetchLogs();

    // 2. Start incremental polling every 3 seconds
    pollIntervalRef.current = setInterval(pollNewLogs, 3000);

    // 3. Subscribe to card changes to refresh nicknames
    const u1 = dashboardEvents.on('card-renamed', fetchLogs);
    const u2 = dashboardEvents.on('cards-changed', fetchLogs);

    return () => {
      // Cleanup
      u1();
      u2();
      if (pollIntervalRef.current) {
        clearInterval(pollIntervalRef.current);
        pollIntervalRef.current = null;
      }
    };
  }, [fetchLogs, pollNewLogs]);

  const refreshLogs = useCallback(() => {
    fetchLogs();
  }, [fetchLogs]);

  return {
    logs,
    loading,
    error,
    refreshLogs,
  };
}
