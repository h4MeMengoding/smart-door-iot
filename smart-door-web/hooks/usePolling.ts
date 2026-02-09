'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import { api } from '@/lib/api';
import { DoorStatus } from '@/lib/types';

interface UsePollingOptions {
  onStatusUpdate?: (status: DoorStatus) => void;
  pollingInterval?: number;
  enabled?: boolean;
}

export function usePolling(options: UsePollingOptions = {}) {
  const {
    onStatusUpdate,
    pollingInterval = 2000, // Poll every 2 seconds
    enabled = true,
  } = options;

  const [isConnected, setIsConnected] = useState(false);
  const [lastStatus, setLastStatus] = useState<DoorStatus | null>(null);
  const [error, setError] = useState<string | null>(null);
  const intervalRef = useRef<NodeJS.Timeout | null>(null);
  const isPollingRef = useRef(false);

  const pollStatus = useCallback(async () => {
    // Prevent concurrent polling
    if (isPollingRef.current) return;
    
    isPollingRef.current = true;
    
    try {
      const status = await api.getDoorStatus();
      setLastStatus(status);
      setIsConnected(true);
      setError(null);
      onStatusUpdate?.(status);
    } catch (err) {
      console.error('Polling error:', err);
      setIsConnected(false);
      setError(err instanceof Error ? err.message : 'Failed to fetch status');
    } finally {
      isPollingRef.current = false;
    }
  }, [onStatusUpdate]);

  const startPolling = useCallback(() => {
    if (!enabled) return;
    
    // Initial fetch
    pollStatus();
    
    // Set up interval
    intervalRef.current = setInterval(() => {
      pollStatus();
    }, pollingInterval);
  }, [enabled, pollingInterval, pollStatus]);

  const stopPolling = useCallback(() => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
    setIsConnected(false);
  }, []);

  useEffect(() => {
    if (enabled) {
      startPolling();
    } else {
      stopPolling();
    }

    return () => {
      stopPolling();
    };
  }, [enabled, startPolling, stopPolling]);

  return {
    isConnected,
    lastStatus,
    error,
    refresh: pollStatus,
  };
}
