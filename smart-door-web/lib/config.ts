// Default ESP32 configuration
export const DEFAULT_ESP32_URL = process.env.NEXT_PUBLIC_ESP32_URL || 'https://esp.ilhame.id';

// API key — only from environment variable, not configurable from UI
export const API_KEY = process.env.NEXT_PUBLIC_DEFAULT_API_KEY || 'Ayamgeprek102938';

// Get ESP32 URL from localStorage or use default
export function getEsp32Url(): string {
  if (typeof window === 'undefined') return DEFAULT_ESP32_URL;
  const stored = localStorage.getItem('esp32_url');
  return stored || DEFAULT_ESP32_URL;
}

export function setEsp32Url(url: string): void {
  // Normalize: remove trailing slash
  const normalized = url.replace(/\/+$/, '');
  localStorage.setItem('esp32_url', normalized);
}

// Legacy alias for backward compatibility
export function getEsp32Ip(): string {
  return getEsp32Url();
}

export function setEsp32Ip(url: string): void {
  setEsp32Url(url);
}

// Get API Key — always from env, never from localStorage
export function getApiKey(): string {
  return API_KEY;
}

export function getApiBaseUrl(): string {
  return getEsp32Url();
}

export function getWebSocketUrl(): string {
  const apiKey = getApiKey();
  const espUrl = getEsp32Url();
  
  // Convert https:// to wss:// and http:// to ws://
  const wsUrl = espUrl.replace(/^https:\/\//, 'wss://').replace(/^http:\/\//, 'ws://');
  const baseUrl = `${wsUrl}/ws`;
  
  if (apiKey) {
    return `${baseUrl}?apikey=${encodeURIComponent(apiKey)}`;
  }
  
  return baseUrl;
}
