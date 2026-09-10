// ============================================
// MQTT Topic Constants & Types
// ============================================

// ESP32 → Server/Dashboard (publish by ESP32)
export const TOPICS = {
  // Status & availability
  STATUS: 'smartdoor/status',              // Retained — full door status
  AVAILABILITY: 'smartdoor/availability',   // Retained — "online" / "offline"
  SYSTEM_INFO: 'smartdoor/system/info',     // Retained — system info

  // Events
  EVENT_CARD_SCAN: 'smartdoor/event/card_scan',
  EVENT_CARD_ADDED: 'smartdoor/event/card_added',
  EVENT_CARD_REMOVED: 'smartdoor/event/card_removed',
  EVENT_REGISTRATION: 'smartdoor/event/registration',
  EVENT_CLONE: 'smartdoor/event/clone',
  EVENT_ACCESS_LOG: 'smartdoor/event/access_log',

  // Command responses
  RESPONSE: 'smartdoor/response',

  // OTA
  OTA_PROGRESS: 'smartdoor/ota/progress',

  // Server/Dashboard → ESP32 (commands)
  CMD_DOOR: 'smartdoor/cmd/door',
  CMD_CARDS: 'smartdoor/cmd/cards',
  CMD_CONFIG: 'smartdoor/cmd/config',
  CMD_MODE: 'smartdoor/cmd/mode',
  CMD_RFID: 'smartdoor/cmd/rfid',
  CMD_TOUCH: 'smartdoor/cmd/touch',
  CMD_SYSTEM: 'smartdoor/cmd/system',
  CMD_TIME: 'smartdoor/cmd/time',
  CMD_SCHEDULE: 'smartdoor/cmd/schedule',
  CMD_OTA: 'smartdoor/cmd/ota',
  OTA_DATA: 'smartdoor/ota/data',
} as const;

// All topics the server subscribes to (from ESP32)
export const SERVER_SUBSCRIBE_TOPICS = [
  TOPICS.STATUS,
  TOPICS.AVAILABILITY,
  TOPICS.SYSTEM_INFO,
  TOPICS.EVENT_CARD_SCAN,
  TOPICS.EVENT_CARD_ADDED,
  TOPICS.EVENT_CARD_REMOVED,
  TOPICS.EVENT_REGISTRATION,
  TOPICS.EVENT_CLONE,
  TOPICS.EVENT_ACCESS_LOG,
  TOPICS.RESPONSE,
  TOPICS.OTA_PROGRESS,
] as const;

// All topics the browser subscribes to (read-only, real-time)
export const BROWSER_SUBSCRIBE_TOPICS = [
  TOPICS.STATUS,
  TOPICS.AVAILABILITY,
  TOPICS.SYSTEM_INFO,
  TOPICS.EVENT_CARD_SCAN,
  TOPICS.EVENT_CARD_ADDED,
  TOPICS.EVENT_CARD_REMOVED,
  TOPICS.EVENT_REGISTRATION,
  TOPICS.EVENT_CLONE,
  TOPICS.OTA_PROGRESS,
] as const;

// MQTT Message types from ESP32
export interface MqttDoorStatus {
  type: 'door_status';
  timestamp: number;
  doorUnlocked: boolean;
  doorStatus: 'LOCKED' | 'UNLOCKED';
  state: string;
  lastCard: string;
  lastEvent: string;
  cardCount: number;
  uptime: string;
  autoLockDuration: number;
  rfidDisabled: boolean;
  rfidAutoEnableMs: number;
  touchDisabled: boolean;
  ntpSynced: boolean;
  currentHour: number;
  currentTime?: string;
}

export interface MqttCardScanEvent {
  type: 'card_scan';
  timestamp: number;
  uid: string;
  success: boolean;
}

export interface MqttCardAddedEvent {
  type: 'card_added';
  timestamp: number;
  uid: string;
  cardCount: number;
  allCards: string[];
}

export interface MqttCardRemovedEvent {
  type: 'card_removed';
  timestamp: number;
  uid: string;
  cardCount: number;
  allCards: string[];
}

export interface MqttRegistrationEvent {
  type: 'registration_mode';
  timestamp: number;
  active: boolean;
}

export interface MqttCloneEvent {
  type: 'clone_status';
  timestamp: number;
  state: string;
  step: string;
  sourceUID?: string;
  result?: string;
}

export interface MqttAccessLogEvent {
  type: 'access_log';
  timestamp: number;
  cardUid: string;
  action: string;
  success: boolean;
  accessType: string;
  isoTimestamp?: string;
}

export interface MqttSystemInfo {
  type: 'system_info';
  timestamp: number;
  ip: string;
  rssi: number;
  uptime: string;
  firmwareVersion: string;
  freeHeap: number;
  totalHeap: number;
  partitionSize?: number;
  usedFlash: number;
  totalFlash: number;
  temperature?: number;
}

export interface MqttOtaProgress {
  percent: number;
  received: number;
  total: number;
  status: string;
}

export interface MqttCommandResponse {
  requestId: string;
  success: boolean;
  message?: string;
  [key: string]: unknown;
}

export type MqttEvent = 
  | MqttDoorStatus
  | MqttCardScanEvent
  | MqttCardAddedEvent
  | MqttCardRemovedEvent
  | MqttRegistrationEvent
  | MqttCloneEvent
  | MqttAccessLogEvent
  | MqttSystemInfo;
