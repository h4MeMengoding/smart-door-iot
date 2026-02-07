import { DoorStatus, Card, SystemInfo, Settings, DoorConfig } from './types';
import { getApiBaseUrl, getApiKey } from './config';

class ApiClient {
  private baseUrl: string;

  constructor() {
    this.baseUrl = getApiBaseUrl();
  }

  updateBaseUrl() {
    this.baseUrl = getApiBaseUrl();
  }

  private async request<T>(
    endpoint: string,
    options?: RequestInit
  ): Promise<T> {
    const apiKey = getApiKey();
    
    const response = await fetch(`${this.baseUrl}${endpoint}`, {
      ...options,
      headers: {
        'Content-Type': 'application/json',
        'X-API-Key': apiKey,
        ...options?.headers,
      },
    });

    if (!response.ok) {
      if (response.status === 401) {
        throw new Error('Unauthorized - Invalid or missing API key');
      }
      throw new Error(`API Error: ${response.statusText}`);
    }

    return response.json();
  }

  // Door Control
  async getDoorStatus(): Promise<DoorStatus> {
    return this.request<DoorStatus>('/api/status');
  }

  async unlockDoor(): Promise<{ success: boolean; message?: string }> {
    return this.request('/api/door/unlock', { method: 'POST' });
  }

  async lockDoor(): Promise<{ success: boolean; message?: string }> {
    return this.request('/api/door/lock', { method: 'POST' });
  }

  // Card Management
  async getCards(): Promise<Card[]> {
    return this.request<Card[]>('/api/cards');
  }

  async addCard(uid: string, nickname?: string): Promise<{ success: boolean; message?: string }> {
    return this.request('/api/cards', {
      method: 'POST',
      body: JSON.stringify({ uid, nickname }),
    });
  }

  async removeCard(uid: string): Promise<{ success: boolean; message?: string }> {
    return this.request('/api/cards/remove', {
      method: 'POST',
      body: JSON.stringify({ uid }),
    });
  }

  async updateCardNickname(uid: string, nickname: string): Promise<{ success: boolean }> {
    return this.request(`/api/cards/${uid}/nickname`, {
      method: 'PUT',
      body: JSON.stringify({ nickname }),
    });
  }

  // System Info
  async getSystemInfo(): Promise<SystemInfo> {
    return this.request<SystemInfo>('/api/system/info');
  }

  async restartEsp(): Promise<{ success: boolean }> {
    return this.request('/api/system/restart', { method: 'POST' });
  }

  // Registration Mode
  async toggleRegistrationMode(): Promise<{ success: boolean; message?: string; registrationMode?: boolean }> {
    return this.request('/api/mode/register', { method: 'POST' });
  }

  // Settings
  async updateSettings(settings: Partial<Settings>): Promise<{ success: boolean }> {
    return this.request('/api/settings', {
      method: 'PUT',
      body: JSON.stringify(settings),
    });
  }

  async getSettings(): Promise<Settings> {
    return this.request<Settings>('/api/settings');
  }

  // Buzzer Test
  async playBuzzer(pattern: string): Promise<{ success: boolean }> {
    return this.request('/api/buzzer/play', {
      method: 'POST',
      body: JSON.stringify({ pattern }),
    });
  }

  // ── Config: Auto-lock & Card Delays (push to ESP32) ──

  async pushAutoLockDuration(durationSec: number): Promise<{ success: boolean }> {
    return this.request('/api/config/autolock', {
      method: 'POST',
      body: JSON.stringify({ duration: durationSec }),
    });
  }

  async pushCardDelay(uid: string, delaySec: number): Promise<{ success: boolean }> {
    return this.request('/api/config/card-delay', {
      method: 'POST',
      body: JSON.stringify({ uid, delay: delaySec }),
    });
  }

  async getEspConfig(): Promise<DoorConfig> {
    return this.request<DoorConfig>('/api/config');
  }

  // Push full card list to ESP32 (DB → ESP32 sync)
  async syncCardsToEsp(uids: string[]): Promise<{ success: boolean; count?: number }> {
    return this.request('/api/cards/sync', {
      method: 'POST',
      body: JSON.stringify({ uids }),
    });
  }
}

export const api = new ApiClient();
