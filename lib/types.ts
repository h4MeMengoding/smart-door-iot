export interface DoorStatus {
  doorUnlocked: boolean;
  doorStatus: 'LOCKED' | 'UNLOCKED';
  state: 'IDLE' | 'AUTH_CHECK' | 'PRE_UNLOCK' | 'UNLOCK' | 'REGISTRATION_MODE' | 'ERROR';
  lastCard: string;
  lastEvent: string;
  cardCount: number;
  uptime: string;
  autoLockDuration?: number; // seconds, from ESP32 config
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
  temperature?: number;
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
  type: 'door_status' | 'card_scan' | 'system_info' | 'error' | 'card_added' | 'card_removed' | 'registration_mode';
  data: any;
  timestamp: number;
}
