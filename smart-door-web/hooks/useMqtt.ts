// ============================================
// useMqtt — Browser-side MQTT hook
// ============================================
// Connects to EMQX broker via WebSocket (WSS) for real-time updates.
// Replaces the old useWebSocket hook that connected directly to ESP32.

'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import type { MqttClient } from 'mqtt';
import { TOPICS } from '@/lib/mqttTopics';
import { MQTT_CONFIG } from '@/lib/config';
import { WebSocketMessage } from '@/lib/types';

interface UseMqttOptions {
  onMessage?: (message: WebSocketMessage) => void;
  onConnect?: () => void;
  onDisconnect?: () => void;
}

function getMqttWsUrl(): string {
  // Browser connects to EMQX via WebSocket
  if (typeof window === 'undefined') return '';
  return (
    localStorage.getItem('mqtt_ws_url') ||
    MQTT_CONFIG.wsUrl
  );
}

function getMqttCredentials() {
  return {
    username: MQTT_CONFIG.wsUsername,
    password: MQTT_CONFIG.wsPassword,
  };
}

// Map MQTT topic + payload to WebSocketMessage for backward compatibility
function toWebSocketMessage(topic: string, payload: Record<string, unknown>): WebSocketMessage | null {
  const timestamp = (payload.timestamp as number) || Date.now();

  switch (topic) {
    case TOPICS.STATUS:
      return { type: 'door_status', data: payload, timestamp };
    case TOPICS.EVENT_CARD_SCAN:
      return { type: 'card_scan', data: payload, timestamp };
    case TOPICS.EVENT_CARD_ADDED:
      return { type: 'card_added', data: payload, timestamp };
    case TOPICS.EVENT_CARD_REMOVED:
      return { type: 'card_removed', data: payload, timestamp };
    case TOPICS.EVENT_REGISTRATION:
      return { type: 'registration_mode', data: payload, timestamp };
    case TOPICS.EVENT_CLONE:
      return { type: 'clone_status', data: payload, timestamp };
    case TOPICS.SYSTEM_INFO:
      return { type: 'system_info', data: payload, timestamp };
    case TOPICS.EVENT_ACCESS_LOG:
      return { type: 'access_log', data: payload, timestamp };
    default:
      return null;
  }
}

export function useMqtt(options: UseMqttOptions = {}) {
  const [isConnected, setIsConnected] = useState(false);
  const [deviceOnline, setDeviceOnline] = useState(false);
  const [lastMessage, setLastMessage] = useState<WebSocketMessage | null>(null);
  const clientRef = useRef<MqttClient | null>(null);
  const mountedRef = useRef(false);
  const connectTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Store callbacks in refs
  const onMessageRef = useRef(options.onMessage);
  const onConnectRef = useRef(options.onConnect);
  const onDisconnectRef = useRef(options.onDisconnect);

  useEffect(() => { onMessageRef.current = options.onMessage; }, [options.onMessage]);
  useEffect(() => { onConnectRef.current = options.onConnect; }, [options.onConnect]);
  useEffect(() => { onDisconnectRef.current = options.onDisconnect; }, [options.onDisconnect]);

  const connect = useCallback(async () => {
    if (!mountedRef.current) return;
    if (clientRef.current?.connected) return;

    const wsUrl = getMqttWsUrl();
    if (!wsUrl) return;

    const creds = getMqttCredentials();

    try {
      // Keep the sizeable MQTT client out of the critical dashboard bundle.
      const { default: mqtt } = await import('mqtt');
      if (!mountedRef.current || clientRef.current?.connected) return;

      const client = mqtt.connect(wsUrl, {
        username: creds.username,
        password: creds.password,
        clientId: `smartdoor-dash-${Date.now()}`,
        protocolVersion: 4,       // MQTT 3.1.1 — more compatible with EMQX Cloud
        clean: true,
        reconnectPeriod: 5000,
        connectTimeout: 10000,
        keepalive: 30,
      });

      clientRef.current = client;

      client.on('connect', () => {
        if (!mountedRef.current) {
          client.end();
          return;
        }
        
        setIsConnected(true);
        onConnectRef.current?.();

        // Subscribe to all smartdoor topics via wildcard
        client.subscribe('smartdoor/#', { qos: 1 } as Parameters<typeof client.subscribe>[1]);
      });

      client.on('message', (topic: string, message: Buffer) => {
        if (!mountedRef.current) return;
        
        try {
          // Handle availability (plain text)
          if (topic === TOPICS.AVAILABILITY) {
            setDeviceOnline(message.toString() === 'online');
            return;
          }

          const payload = JSON.parse(message.toString());
          const wsMessage = toWebSocketMessage(topic, payload);
          
          if (wsMessage) {
            setLastMessage(wsMessage);
            onMessageRef.current?.(wsMessage);
          }
        } catch {
          // Ignore parse errors
        }
      });

      client.on('close', () => {
        if (!mountedRef.current) return;
        setIsConnected(false);
        onDisconnectRef.current?.();
      });

      client.on('error', () => {
        // close event will handle cleanup
      });

    } catch {
      // Connection failed
    }
  }, []);

  const disconnect = useCallback(() => {
    if (connectTimerRef.current) {
      clearTimeout(connectTimerRef.current);
      connectTimerRef.current = null;
    }
    if (clientRef.current) {
      clientRef.current.end(true);
      clientRef.current = null;
    }
    setIsConnected(false);
  }, []);

  const reconnect = useCallback(() => {
    disconnect();
    setTimeout(connect, 100);
  }, [connect, disconnect]);

  useEffect(() => {
    mountedRef.current = true;
    
    // Defer connection to next tick (React Strict Mode safe)
    connectTimerRef.current = setTimeout(connect, 0);

    // Reconnect on tab visibility change
    const handleVisibility = () => {
      if (document.visibilityState === 'visible' && mountedRef.current) {
        if (!clientRef.current?.connected) {
          reconnect();
        }
      }
    };
    document.addEventListener('visibilitychange', handleVisibility);

    return () => {
      mountedRef.current = false;
      document.removeEventListener('visibilitychange', handleVisibility);
      disconnect();
    };
  }, [connect, disconnect, reconnect]);

  // sendMessage is a no-op — commands go through Next.js API, not MQTT
  const sendMessage = useCallback(() => {
    console.warn('useMqtt.sendMessage is deprecated. Use api.* methods instead.');
  }, []);

  return {
    isConnected,
    deviceOnline,
    lastMessage,
    sendMessage,
    reconnect,
    disconnect,
  };
}

// ── Also export as useWebSocket for backward compatibility ──
export { useMqtt as useWebSocket };
