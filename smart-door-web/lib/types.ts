export interface DoorStatus {
  doorUnlocked: boolean;
  doorStatus: 'LOCKED' | 'UNLOCKED';
  state: 'IDLE' | 'AUTH_CHECK' | 'PRE_UNLOCK' | 'UNLOCK' | 'REGISTRATION_MODE' | 'CLONE_MODE' | 'ERROR';
  lastCard: string;
  lastEvent: string;
  cardCount: number;
  uptime: string;
  autoLockDuration?: number; // seconds, from ESP32 config
  rfidDisabled?: boolean;    // RFID reader disabled flag
  rfidAutoEnableMs?: number;  // Milliseconds until RFID auto re-enables (0 = no timer)
  ntpSynced?: boolean;       // NTP time sync status
  currentHour?: number;      // Current ESP32 hour (0-23)
  currentTime?: string;      // Current ESP32 time string "HH:MM:SS"
}

export interface EspTime {
  ntpSynced: boolean;
  hour: number;
  minute: number;
  second: number;
  day: number;
  month: number;
  year: number;
  time: string;
  date: string;
  epoch: number;
}

export interface SystemInfo {
  ip: string;
  rssi?: number;
  firmwareVersion?: string;
  uptime: string;
  freeHeap?: number;
  totalHeap?: number;
  usedFlash?: number;
  totalFlash?: number;
  partitionSize?: number;
  temperature?: number;
}

export interface CloneStatus {
  success: boolean;
  state: string;
  step: string;
  sourceUID?: string;
  cloneResult: string;
}

export interface Card {
  uid: string;
  nickname?: string;
  addedAt?: string;
  lastUsed?: string;
}

export interface AccessLog {
  id: string;
  timestamp: string;
  cardUid: string | null;
  cardNickname?: string;
  action: 'unlock' | 'denied' | 'registered';
  success: boolean;
  accessType?: 'RFID' | 'WEB' | 'TOUCH';
}

export interface CardDelayConfig {
  cardUid: string;
  delaySec: number;
  enabled: boolean;
}

export interface CardDelayScheduleConfig {
  cardUid: string;
  startHour: number;
  endHour: number;
  delaySec: number;
  slot?: number;
}

export interface ScheduledRestartConfig {
  mode: number;      // 0=off, 1=at_hour, 2=every_hours
  hour: number;      // 0-23 for at_hour mode
  interval: number;  // 1-24 for every_hours mode
}

export interface DoorConfig {
  autoLockDuration: number;
  cardDelays: CardDelayConfig[];
}

export interface Settings {
  autoLockDuration: number;
  esp32Ip: string;
  enableNotifications: boolean;
}

export interface WebSocketMessage {
  type: 'door_status' | 'card_scan' | 'system_info' | 'error' | 'card_added' | 'card_removed' | 'registration_mode' | 'clone_status' | 'access_log';
  data: any;
  timestamp: number;
}
