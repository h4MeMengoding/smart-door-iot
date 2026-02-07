'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { AccessLog } from '@/lib/types';
import { dashboardEvents } from '@/lib/dashboardEvents';

/**
 * Hook untuk mengambil access logs secara realtime via SSE.
 * - Fetch initial data sekali saat mount
 * - Subscribe ke SSE stream untuk update realtime (tanpa polling)
 * - Auto-reconnect jika koneksi terputus
 */
export function useServerLogs() {
  const [logs, setLogs] = useState<AccessLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const eventSourceRef = useRef<EventSource | null>(null);
  const reconnectTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Fetch semua logs dari database (hanya sekali saat mount / manual refresh)
  const fetchLogs = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const response = await fetch('/api/logs');

      if (!response.ok) {
        throw new Error('Failed to fetch logs');
      }

      const data = await response.json();
      setLogs(data);
    } catch (err) {
      console.error('Error fetching logs:', err);
      setError(err instanceof Error ? err.message : 'Failed to fetch logs');
    } finally {
      setLoading(false);
    }
  }, []);

  // Connect ke SSE stream
  const connectSSE = useCallback(() => {
    // Cleanup existing connection
    if (eventSourceRef.current) {
      eventSourceRef.current.close();
    }

    const es = new EventSource('/api/logs/stream');
    eventSourceRef.current = es;

    es.onmessage = (event) => {
      try {
        const newLog: AccessLog = JSON.parse(event.data);
        // Prepend log baru ke awal array (newest first)
        setLogs((prev) => [newLog, ...prev]);
      } catch {
        // Ignore parse errors (heartbeat comments, etc.)
      }
    };

    es.onerror = () => {
      es.close();
      eventSourceRef.current = null;

      // Auto-reconnect setelah 3 detik
      reconnectTimeoutRef.current = setTimeout(() => {
        connectSSE();
      }, 3000);
    };
  }, []);

  useEffect(() => {
    // 1. Fetch initial data
    fetchLogs();

    // 2. Connect SSE untuk realtime updates
    connectSSE();

    // 3. Subscribe to card changes to refresh nicknames
    const u1 = dashboardEvents.on('card-renamed', fetchLogs);
    const u2 = dashboardEvents.on('cards-changed', fetchLogs);

    return () => {
      // Cleanup
      u1();
      u2();
      eventSourceRef.current?.close();
      eventSourceRef.current = null;
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current);
      }
    };
  }, [fetchLogs, connectSSE]);

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
