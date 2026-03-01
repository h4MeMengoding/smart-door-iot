// ============================================
// Configuration — MQTT Mode
// ============================================

// API key — shared secret for authentication
export const API_KEY = process.env.NEXT_PUBLIC_DEFAULT_API_KEY || process.env.ESP32_API_KEY || '';

// MQTT configuration
export const MQTT_CONFIG = {
  // Server-side MQTT (MQTTS)
  brokerUrl: process.env.MQTT_BROKER_URL || 'mqtts://localhost:8883',
  username: process.env.MQTT_USERNAME || 'smartdoor-server',
  password: process.env.MQTT_PASSWORD || '',
  
  // Browser-side MQTT (WSS)
  wsUrl: process.env.NEXT_PUBLIC_MQTT_WS_URL || 'wss://localhost:8084/mqtt',
  wsUsername: process.env.NEXT_PUBLIC_MQTT_WS_USERNAME || 'smartdoor-web',
  wsPassword: process.env.NEXT_PUBLIC_MQTT_WS_PASSWORD || '',
};

// ESP32 HTTP OTA config
export const ESP32_OTA_URL = process.env.ESP32_OTA_URL || 'https://esp.ilhame.id/ota';
export const ESP32_OTA_PASSWORD = process.env.ESP32_OTA_PASSWORD || '';

// Web Push (VAPID) configuration
// Generate with: npx web-push generate-vapid-keys
export const VAPID_PUBLIC_KEY = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY || '';
export const VAPID_PRIVATE_KEY = process.env.VAPID_PRIVATE_KEY || '';

// API key getter
export function getApiKey(): string {
  return API_KEY;
}

// MQTT WebSocket URL for browser
export function getMqttWsUrl(): string {
  if (typeof window === 'undefined') return MQTT_CONFIG.wsUrl;
  const stored = localStorage.getItem('mqtt_ws_url');
  return stored || MQTT_CONFIG.wsUrl;
}

export function setMqttWsUrl(url: string): void {
  localStorage.setItem('mqtt_ws_url', url);
}

