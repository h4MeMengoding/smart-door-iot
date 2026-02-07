// Default ESP32 configuration
export const DEFAULT_ESP32_IP = '10.10.1.5';
export const DEFAULT_ESP32_PORT = 80;
export const DEFAULT_WS_PORT = 81;

// API key — only from environment variable, not configurable from UI
export const API_KEY = process.env.NEXT_PUBLIC_DEFAULT_API_KEY || 'Ayamgeprek102938';

// Get ESP32 IP from localStorage or use default
export function getEsp32Ip(): string {
  if (typeof window === 'undefined') return DEFAULT_ESP32_IP;
  return localStorage.getItem('esp32_ip') || DEFAULT_ESP32_IP;
}

export function setEsp32Ip(ip: string): void {
  localStorage.setItem('esp32_ip', ip);
}

// Get API Key — always from env, never from localStorage
export function getApiKey(): string {
  return API_KEY;
}

export function getApiBaseUrl(): string {
  return `http://${getEsp32Ip()}:${DEFAULT_ESP32_PORT}`;
}

export function getWebSocketUrl(): string {
  const apiKey = getApiKey();
  const baseUrl = `ws://${getEsp32Ip()}:${DEFAULT_ESP32_PORT}/ws`;
  
  if (apiKey) {
    return `${baseUrl}?apikey=${encodeURIComponent(apiKey)}`;
  }
  
  return baseUrl;
}
