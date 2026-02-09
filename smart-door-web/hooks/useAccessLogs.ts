'use client';

import { useState, useEffect, useCallback } from 'react';
import { AccessLog } from '@/lib/types';

/**
 * Hook untuk mengambil access logs dari database via API.
 * Menggantikan versi lama yang menggunakan localStorage.
 */
export function useAccessLogs() {
  const [logs, setLogs] = useState<AccessLog[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchLogs = useCallback(async () => {
    try {
      setLoading(true);
      const response = await fetch('/api/logs');
      if (!response.ok) throw new Error('Failed to fetch logs');
      const data = await response.json();
      setLogs(data);
    } catch (err) {
      console.error('Error fetching logs:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchLogs();
  }, [fetchLogs]);

  const clearAccessLogs = async () => {
    try {
      const response = await fetch('/api/logs/clear', { method: 'DELETE' });
      if (!response.ok) throw new Error('Failed to clear logs');
      setLogs([]);
    } catch (err) {
      console.error('Error clearing logs:', err);
    }
  };

  const refreshLogs = useCallback(() => {
    fetchLogs();
  }, [fetchLogs]);

  return {
    logs,
    loading,
    clearAccessLogs,
    refreshLogs,
  };
}
