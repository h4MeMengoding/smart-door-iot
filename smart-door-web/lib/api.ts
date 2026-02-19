// ============================================
// API Client — Routes all commands through Next.js API → MQTT
// ============================================
// No more direct ESP32 HTTP calls. All commands go:
//   Browser → Next.js /api/esp → MQTT → ESP32

import { DoorStatus, Card, SystemInfo, DoorConfig, CloneStatus, ScheduledRestartConfig, EspTime } from './types';

class ApiClient {
  // Send a command to ESP32 via Next.js MQTT proxy
  private async command<T>(command: string, params?: Record<string, unknown>): Promise<T> {
    const response = await fetch('/api/esp', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ command, ...params }),
    });

    if (!response.ok) {
      if (response.status === 401) {
        throw new Error('Unauthorized');
      }
      const data = await response.json().catch(() => ({ message: response.statusText }));
      throw new Error(data.message || `API Error: ${response.status}`);
    }

    return response.json();
  }

  // Query ESP32 via Next.js MQTT proxy (GET)
  private async query<T>(command: string): Promise<T> {
    const response = await fetch(`/api/esp?command=${encodeURIComponent(command)}`, {
      headers: { 'Content-Type': 'application/json' },
    });

    if (!response.ok) {
      if (response.status === 401) {
        throw new Error('Unauthorized');
      }
      const data = await response.json().catch(() => ({ message: response.statusText }));
      throw new Error(data.message || `API Error: ${response.status}`);
    }

    return response.json();
  }

  // ── Door Control ──
  
  async getDoorStatus(): Promise<DoorStatus> {
    return this.query<DoorStatus>('door.status');
  }

  async unlockDoor(): Promise<{ success: boolean; message?: string }> {
    return this.command('door.unlock');
  }

  async lockDoor(): Promise<{ success: boolean; message?: string }> {
    return this.command('door.lock');
  }

  // ── Card Management ──

  async getCards(): Promise<Card[]> {
    const result = await this.command<{ cards: string[]; count: number }>('cards.list');
    return (result.cards || []).map(uid => ({ uid }));
  }

  async addCard(uid: string, nickname?: string): Promise<{ success: boolean; message?: string }> {
    return this.command('cards.add', { uid, nickname });
  }

  async removeCard(uid: string): Promise<{ success: boolean; message?: string }> {
    return this.command('cards.remove', { uid });
  }

  async updateCardNickname(uid: string, nickname: string): Promise<{ success: boolean }> {
    // Card nicknames are stored in the web database, not on ESP32
    const response = await fetch('/api/cards', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ uid, nickname }),
    });
    return response.json();
  }

  // ── System Info ──

  async getSystemInfo(): Promise<SystemInfo> {
    return this.query<SystemInfo>('system.info');
  }

  async restartEsp(): Promise<{ success: boolean }> {
    return this.command('system.restart');
  }

  // ── Registration Mode ──

  async toggleRegistrationMode(): Promise<{ success: boolean; message?: string; registrationMode?: boolean }> {
    return this.command('mode.register');
  }

  // ── Buzzer ──

  async playBuzzer(pattern: string): Promise<{ success: boolean }> {
    return this.command('system.buzzer', { pattern });
  }

  // ── Config ──

  async pushAutoLockDuration(durationSec: number): Promise<{ success: boolean }> {
    return this.command('config.set_autolock', { duration: durationSec });
  }

  async pushCardDelay(uid: string, delaySec: number): Promise<{ success: boolean }> {
    return this.command('config.set_card_delay', { uid, delay: delaySec });
  }

  async getEspConfig(): Promise<DoorConfig> {
    return this.command<DoorConfig>('config.get');
  }

  async syncCardsToEsp(uids: string[]): Promise<{ success: boolean; count?: number }> {
    return this.command('cards.sync', { uids });
  }

  // ── Clone Mode ──

  async startClone(): Promise<{ success: boolean; message?: string }> {
    return this.command('mode.clone_start');
  }

  async cancelClone(): Promise<{ success: boolean; message?: string }> {
    return this.command('mode.clone_cancel');
  }

  async getCloneStatus(): Promise<CloneStatus> {
    return this.command<CloneStatus>('mode.clone_status');
  }

  // ── RFID Toggle ──

  async toggleRfid(): Promise<{ success: boolean; rfidDisabled: boolean; rfidAutoEnableMs?: number; message: string }> {
    return this.command('rfid.toggle');
  }

  async disableRfidTimed(minutes: number): Promise<{ success: boolean; rfidDisabled: boolean; rfidAutoEnableMs: number; message: string }> {
    return this.command('rfid.disable_timed', { minutes });
  }

  async getRfidStatus(): Promise<{ rfidDisabled: boolean; rfidAutoEnableMs?: number }> {
    return this.command<{ rfidDisabled: boolean; rfidAutoEnableMs?: number }>('rfid.status');
  }

  // ── Scheduled Restart ──

  async getScheduledRestart(): Promise<ScheduledRestartConfig> {
    return this.command<ScheduledRestartConfig>('schedule.get');
  }

  async setScheduledRestart(config: ScheduledRestartConfig): Promise<{ success: boolean } & ScheduledRestartConfig> {
    return this.command('schedule.set', { ...config });
  }

  // ── Card Delay Schedule ──

  async getEspSchedules(): Promise<{ success: boolean; ntpSynced: boolean; currentHour: number; schedules: { uid: string; startHour: number; endHour: number; delaySec: number }[] }> {
    return this.command('config.get_schedules');
  }

  async pushCardSchedule(uid: string, startHour: number, endHour: number, delaySec: number): Promise<{ success: boolean }> {
    return this.command('config.set_schedule', { uid, startHour, endHour, delaySec });
  }

  async removeCardSchedule(uid: string): Promise<{ success: boolean }> {
    return this.command('config.set_schedule', { uid, remove: true });
  }

  async pushBulkCardSchedules(schedules: { uid: string; startHour: number; endHour: number; delaySec: number; remove?: boolean }[]): Promise<{ success: boolean }> {
    return this.command('config.set_schedule', { schedules });
  }

  // ── ESP32 Time ──

  async getEspTime(): Promise<EspTime> {
    return this.command<EspTime>('time.get');
  }

  async syncEspTime(): Promise<{ success: boolean; ntpSynced: boolean; time?: string; message?: string }> {
    return this.command('time.sync');
  }

  async setEspTime(epoch: number): Promise<{ success: boolean; time?: string; hour?: number; message?: string }> {
    return this.command('time.set', { epoch });
  }

  // ── Settings (stored in web DB, not ESP32) ──

  async updateSettings(settings: Partial<{ autoLockDuration: number; enableNotifications: boolean }>): Promise<{ success: boolean }> {
    const response = await fetch('/api/config', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(settings),
    });
    return response.json();
  }

  async getSettings(): Promise<{ autoLockDuration: number; enableNotifications: boolean }> {
    const response = await fetch('/api/config');
    return response.json();
  }

}

export const api = new ApiClient();
