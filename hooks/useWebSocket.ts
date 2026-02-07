'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import { getWebSocketUrl, getApiKey } from '@/lib/config';
import { WebSocketMessage } from '@/lib/types';

interface UseWebSocketOptions {
  onMessage?: (message: WebSocketMessage) => void;
  onConnect?: () => void;
  onDisconnect?: () => void;
  autoReconnect?: boolean;
  reconnectInterval?: number;
}

export function useWebSocket(options: UseWebSocketOptions = {}) {
  const {
    autoReconnect = true,
    reconnectInterval = 5000,
  } = options;

  const [isConnected, setIsConnected] = useState(false);
  const [lastMessage, setLastMessage] = useState<WebSocketMessage | null>(null);
  const wsRef = useRef<WebSocket | null>(null);
  const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const connectTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const reconnectAttemptsRef = useRef(0);
  const maxReconnectAttempts = 10;
  const mountedRef = useRef(false);
  
  // Store options in refs to avoid stale closures
  const autoReconnectRef = useRef(autoReconnect);
  const reconnectIntervalRef = useRef(reconnectInterval);

  // Store callbacks in refs to avoid dependency changes triggering reconnects
  const onMessageRef = useRef(options.onMessage);
  const onConnectRef = useRef(options.onConnect);
  const onDisconnectRef = useRef(options.onDisconnect);

  useEffect(() => { autoReconnectRef.current = autoReconnect; }, [autoReconnect]);
  useEffect(() => { reconnectIntervalRef.current = reconnectInterval; }, [reconnectInterval]);
  useEffect(() => { onMessageRef.current = options.onMessage; }, [options.onMessage]);
  useEffect(() => { onConnectRef.current = options.onConnect; }, [options.onConnect]);
  useEffect(() => { onDisconnectRef.current = options.onDisconnect; }, [options.onDisconnect]);

  const connect = useCallback(() => {
    if (!mountedRef.current) return;

    // Close existing connection if any
    if (wsRef.current) {
      const s = wsRef.current.readyState;
      if (s === WebSocket.CONNECTING || s === WebSocket.CLOSING) return;
      if (s === WebSocket.OPEN) {
        wsRef.current.onopen = null;
        wsRef.current.onmessage = null;
        wsRef.current.onerror = null;
        wsRef.current.onclose = null;
        wsRef.current.close();
      }
      wsRef.current = null;
    }

    const wsUrl = getWebSocketUrl();
    if (!getApiKey()) return;

    try {
      const ws = new WebSocket(wsUrl);
      wsRef.current = ws;

      ws.onopen = () => {
        if (!mountedRef.current) {
          ws.onopen = null;
          ws.onmessage = null;
          ws.onerror = null;
          ws.onclose = null;
          ws.close();
          return;
        }
        reconnectAttemptsRef.current = 0;
        setIsConnected(true);
        onConnectRef.current?.();
      };

      ws.onmessage = (event) => {
        if (!mountedRef.current) return;
        try {
          const message: WebSocketMessage = JSON.parse(event.data);
          setLastMessage(message);
          onMessageRef.current?.(message);
        } catch {
          // Ignore parse errors
        }
      };

      ws.onclose = () => {
        if (!mountedRef.current) return;
        setIsConnected(false);
        wsRef.current = null;
        onDisconnectRef.current?.();
        
        if (autoReconnectRef.current && reconnectAttemptsRef.current < maxReconnectAttempts) {
          reconnectAttemptsRef.current++;
          const delay = Math.min(reconnectIntervalRef.current * reconnectAttemptsRef.current, 30000);
          reconnectTimeoutRef.current = setTimeout(connect, delay);
        }
      };

      ws.onerror = () => {
        // onclose will handle reconnection
      };
    } catch {
      // Connection failed
    }
  }, []);

  const disconnect = useCallback(() => {
    // Cancel any pending reconnect
    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current);
      reconnectTimeoutRef.current = null;
    }
    // Cancel any pending connect timer
    if (connectTimerRef.current) {
      clearTimeout(connectTimerRef.current);
      connectTimerRef.current = null;
    }
    // Close existing socket
    if (wsRef.current) {
      wsRef.current.onopen = null;
      wsRef.current.onmessage = null;
      wsRef.current.onerror = null;
      wsRef.current.onclose = null;
      if (wsRef.current.readyState === WebSocket.OPEN) {
        wsRef.current.close();
      }
      wsRef.current = null;
    }
    setIsConnected(false);
  }, []);

  const sendMessage = useCallback((message: any) => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify(message));
    }
  }, []);

  useEffect(() => {
    mountedRef.current = true;

    // Defer connection to next tick — React Strict Mode's synchronous
    // unmount/remount will cancel the first timer, preventing double connections
    connectTimerRef.current = setTimeout(connect, 0);

    // Reconnect when tab becomes visible again
    const handleVisibility = () => {
      if (document.visibilityState === 'visible' && mountedRef.current) {
        // Reset reconnect attempts so it tries fresh
        reconnectAttemptsRef.current = 0;
        // If not connected, reconnect immediately
        if (!wsRef.current || wsRef.current.readyState !== WebSocket.OPEN) {
          if (reconnectTimeoutRef.current) {
            clearTimeout(reconnectTimeoutRef.current);
            reconnectTimeoutRef.current = null;
          }
          connect();
        }
      }
    };
    document.addEventListener('visibilitychange', handleVisibility);

    return () => {
      mountedRef.current = false;
      document.removeEventListener('visibilitychange', handleVisibility);
      disconnect();
    };
  }, [connect, disconnect]);

  return {
    isConnected,
    lastMessage,
    sendMessage,
    reconnect: connect,
    disconnect,
  };
}
