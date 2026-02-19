// ============================================
// Server-side MQTT Client Singleton
// ============================================
// Maintains a persistent MQTT connection to EMQX broker.
// Used by API routes to send commands and receive responses.
// Also processes incoming ESP32 events (access logs, card sync).

import mqtt from 'mqtt';
import { TOPICS, SERVER_SUBSCRIBE_TOPICS, MqttCommandResponse, MqttAccessLogEvent } from './mqttTopics';
import { MQTT_CONFIG } from './config';
import { dashboardEvents } from './dashboardEvents';

// ── Configuration ──

export function getMqttConfig() {
  return {
    brokerUrl: MQTT_CONFIG.brokerUrl,
    username: MQTT_CONFIG.username,
    password: MQTT_CONFIG.password,
    clientId: `smartdoor-web-${process.env.NODE_ENV || 'dev'}`,
  };
}

// ── Pending request tracking ──

interface PendingRequest {
  resolve: (value: MqttCommandResponse) => void;
  reject: (reason: Error) => void;
  timer: ReturnType<typeof setTimeout>;
}

const pendingRequests = new Map<string, PendingRequest>();

// ── Event listeners for real-time ESP32 events ──

type MqttEventListener = (topic: string, payload: Record<string, unknown>) => void;
const eventListeners: MqttEventListener[] = [];

export function onMqttEvent(listener: MqttEventListener): () => void {
  eventListeners.push(listener);
  return () => {
    const idx = eventListeners.indexOf(listener);
    if (idx >= 0) eventListeners.splice(idx, 1);
  };
}

// ── Latest cached values ──

let cachedStatus: Record<string, unknown> | null = null;
let cachedSystemInfo: Record<string, unknown> | null = null;
let deviceOnline = false;

export function getCachedStatus() { return cachedStatus; }
export function getCachedSystemInfo() { return cachedSystemInfo; }
export function isDeviceOnline() { return deviceOnline; }

// ── Singleton client ──

let client: mqtt.MqttClient | null = null;
let connecting = false;
let subscribed = false;
let subscribedResolvers: (() => void)[] = [];

/** Returns a promise that resolves when subscriptions are confirmed */
function waitForSubscription(): Promise<void> {
  if (subscribed) return Promise.resolve();
  return new Promise<void>((resolve) => {
    subscribedResolvers.push(resolve);
    // Safety timeout — don't block forever (Vercel has 10s limit)
    setTimeout(() => resolve(), 4000);
  });
}

function markSubscribed() {
  subscribed = true;
  for (const r of subscribedResolvers) r();
  subscribedResolvers = [];
}

function getClient(): mqtt.MqttClient {
  if (client && client.connected) return client;
  if (client && !client.connected && !connecting) {
    // Client exists but disconnected — reconnect is automatic
    return client;
  }
  if (connecting) {
    // Wait for connection to complete
    return client!;
  }
  
  connecting = true;
  const config = getMqttConfig();
  
  console.log(`[MQTT] Connecting to ${config.brokerUrl} as ${config.clientId}...`);
  
  client = mqtt.connect(config.brokerUrl, {
    username: config.username,
    password: config.password,
    clientId: config.clientId,
    protocolVersion: 4,       // MQTT 3.1.1 — more compatible with EMQX Cloud
    clean: true,
    reconnectPeriod: 5000,
    connectTimeout: 6000,      // 6s — must fit within Vercel 10s limit
    keepalive: 60,
    will: {
      topic: 'smartdoor/web/availability',
      payload: Buffer.from('offline'),
      qos: 1,
      retain: true,
    },
  });

  client.on('connect', () => {
    connecting = false;
    subscribed = false; // Reset on each (re)connect
    console.log('[MQTT] Connected to broker');
    
    // Publish web server availability
    client!.publish('smartdoor/web/availability', 'online', { retain: true, qos: 1 });
    
    // Subscribe using wildcard — simpler and more compatible with EMQX Cloud ACL
    client!.subscribe('smartdoor/#', { qos: 1 }, (err: Error | null) => {
      if (err) {
        console.error('[MQTT] Wildcard subscribe failed, trying individual topics...', err);
        // Fallback: subscribe individually so partial failures don't block all
        let completed = 0;
        const total = SERVER_SUBSCRIBE_TOPICS.length;
        for (const t of SERVER_SUBSCRIBE_TOPICS) {
          client!.subscribe(t, { qos: 1 }, (subErr: Error | null) => {
            if (subErr) {
              console.warn(`[MQTT] Failed to subscribe to ${t}:`, subErr.message);
            }
            completed++;
            if (completed >= total) {
              markSubscribed();
            }
          });
        }
      } else {
        console.log('[MQTT] Subscribed to smartdoor/# (wildcard)');
        markSubscribed();
      }
    });
  });

  client.on('message', (topic: string, message: Buffer) => {
    try {
      // Handle availability (plain text)
      if (topic === TOPICS.AVAILABILITY) {
        deviceOnline = message.toString() === 'online';
        console.log(`[MQTT] Device ${deviceOnline ? 'online' : 'offline'}`);
        return;
      }
      
      const payload = JSON.parse(message.toString());

      // Handle command responses
      if (topic === TOPICS.RESPONSE) {
        const resp = payload as MqttCommandResponse;
        const pending = pendingRequests.get(resp.requestId);
        if (pending) {
          clearTimeout(pending.timer);
          pending.resolve(resp);
          pendingRequests.delete(resp.requestId);
        }
        return;
      }

      // Cache status and system info
      if (topic === TOPICS.STATUS) {
        cachedStatus = payload;
      } else if (topic === TOPICS.SYSTEM_INFO) {
        cachedSystemInfo = payload;
      }

      // Process access log events — notify listeners only (browser POST handles persistence)
      if (topic === TOPICS.EVENT_ACCESS_LOG) {
        // No server-side persistence here — browser POST to /api/logs handles it
        // This avoids duplicate entries from both paths running simultaneously
      }

      // Notify all event listeners
      for (const listener of eventListeners) {
        try {
          listener(topic, payload);
        } catch {
          // Ignore listener errors
        }
      }
    } catch {
      // Non-JSON or parse error — ignore
    }
  });

  client.on('error', (err: Error) => {
    connecting = false;
    console.error('[MQTT] Connection error:', err.message);
  });

  client.on('close', () => {
    connecting = false;
    deviceOnline = false;
    subscribed = false;
  });

  client.on('reconnect', () => {
    console.log('[MQTT] Reconnecting...');
  });

  // Store on globalThis to survive hot-reload in development
  (globalThis as Record<string, unknown>).__mqttClient = client;
  
  return client;
}

// Restore from globalThis on hot-reload
if ((globalThis as Record<string, unknown>).__mqttClient) {
  client = (globalThis as Record<string, unknown>).__mqttClient as mqtt.MqttClient;
  if (client.connected) {
    connecting = false;
    subscribed = true; // Already connected = already subscribed
  }
}

// ── Send command and wait for response ──

let requestCounter = 0;

export async function sendCommand(
  topic: string, 
  payload: Record<string, unknown>, 
  timeoutMs = 10000
): Promise<MqttCommandResponse> {
  const mqttClient = getClient();
  
  // Wait for connection if not yet connected
  if (!mqttClient.connected) {
    await new Promise<void>((resolve, reject) => {
      const timer = setTimeout(() => reject(new Error('MQTT connection timeout')), 3000);
      mqttClient.once('connect', () => {
        clearTimeout(timer);
        resolve();
      });
    });
  }
  
  // Wait for subscriptions to be confirmed so we can receive the response
  await waitForSubscription();
  
  const requestId = `req_${Date.now()}_${++requestCounter}`;
  
  return new Promise<MqttCommandResponse>((resolve, reject) => {
    const timer = setTimeout(() => {
      pendingRequests.delete(requestId);
      reject(new Error(`MQTT command timeout (${timeoutMs}ms) for ${topic}`));
    }, timeoutMs);

    pendingRequests.set(requestId, { resolve, reject, timer });

    const message = JSON.stringify({ ...payload, requestId });
    mqttClient.publish(topic, message, { qos: 1 }, (err) => {
      if (err) {
        clearTimeout(timer);
        pendingRequests.delete(requestId);
        reject(new Error(`MQTT publish error: ${err.message}`));
      }
    });
  });
}

// ── Publish (fire-and-forget) ──

export function publish(topic: string, payload: unknown, options?: { retain?: boolean; qos?: 0 | 1 | 2 }) {
  const mqttClient = getClient();
  const message = typeof payload === 'string' ? payload : JSON.stringify(payload);
  mqttClient.publish(topic, message, {
    qos: options?.qos ?? 1,
    retain: options?.retain ?? false,
  });
}

// ── Publish binary data (for OTA) ──

export function publishBinary(topic: string, data: Buffer, options?: { qos?: 0 | 1 | 2 }): Promise<void> {
  return new Promise((resolve, reject) => {
    const mqttClient = getClient();
    mqttClient.publish(topic, data, { qos: options?.qos ?? 1 }, (err) => {
      if (err) reject(err);
      else resolve();
    });
  });
}

// ── Process access log from ESP32 ──

async function processAccessLog(event: MqttAccessLogEvent) {
  // Dynamic import to avoid circular dependencies
  const { addAccessLog, upsertCard } = await import('./db');
  const { logEvents } = await import('./events');

  // Upsert card credential
  if (event.cardUid && event.cardUid !== 'MQTT' && event.cardUid !== 'TOUCH') {
    await upsertCard(event.cardUid);
  }

  // Create access log entry
  const log = await addAccessLog({
    uid: event.cardUid || null,
    accessType: event.accessType || 'RFID',
    accessResult: event.success ? 'granted' : 'denied',
  });

  // Emit for real-time polling
  if (log) {
    logEvents.emit({
      id: log.id,
      timestamp: log.createdAt.toISOString(),
      cardUid: log.uid,
      action: event.action as 'unlock' | 'denied' | 'registered',
      success: event.success,
      accessType: event.accessType as 'RFID' | 'WEB' | 'TOUCH',
    });
  }

  // Create system event
  try {
    const { addSystemEvent } = await import('./db');
    await addSystemEvent(
      event.success ? 'access_granted' : 'access_denied',
      `Card ${event.cardUid || 'unknown'} - ${event.action} (${event.accessType})`
    );
  } catch {
    // Non-critical
  }
}

// ── Initialize MQTT on first import ──
// This ensures the client is created when the module is loaded

export function initMqtt() {
  getClient();
}

// Auto-initialize if broker URL is configured
if (process.env.MQTT_BROKER_URL) {
  initMqtt();
}
