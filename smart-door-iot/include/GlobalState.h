#ifndef GLOBAL_STATE_H
#define GLOBAL_STATE_H

#include <Arduino.h>
#include <MFRC522.h>
#include <Preferences.h>
#include "config.h"

// ============================================
// GLOBAL OBJECTS
// ============================================

extern MFRC522 rfid;
extern Preferences nvs;

// ============================================
// STATE MACHINE
// ============================================

enum SystemState {
    STATE_IDLE,
    STATE_AUTH_CHECK,
    STATE_PRE_UNLOCK,        // Waiting for card-specific delay before unlock
    STATE_UNLOCK,
    STATE_REGISTRATION_MODE,
    STATE_CLONE_MODE,        // UID clone mode
    STATE_ERROR
};

enum CloneStep {
    CLONE_WAIT_SOURCE,       // Waiting for source card
    CLONE_WAIT_TARGET        // Waiting for target (magic) card
};

extern SystemState currentState;
extern unsigned long stateStartTime;
extern unsigned long lastActivityTime;

// ============================================
// DOOR & RELAY STATE
// ============================================

extern bool doorUnlocked;
extern unsigned long lastRelayToggle;

// ============================================
// RFID CARD DATA
// ============================================

struct CardUID {
    byte size;
    byte uid[UID_MAX_SIZE];
};

extern CardUID userCards[MAX_USER_CARDS];
extern uint8_t userCardCount;

extern byte lastScannedUID[UID_MAX_SIZE];
extern byte lastScannedSize;
extern unsigned long lastScanTime;

// ============================================
// BUZZER STATE
// ============================================

extern BuzzerPattern currentPattern;
extern uint8_t currentBeep;
extern unsigned long buzzerStartTime;
extern bool buzzerState;

// ============================================
// TOUCH SENSOR STATE
// ============================================

extern bool lastTouchState;
extern unsigned long touchDebounceStart;
extern bool touchStable;
extern unsigned long touchHighStart;      // When HIGH signal started
extern unsigned long lastTouchTrigger;    // Last time touch was registered

// ============================================
// LED STATE
// ============================================

extern unsigned long lastLedToggle;
extern bool ledState;

// ============================================
// WIFI & WEB STATE
// ============================================

extern bool wifiConnected;
extern String lastCardUID;
extern String lastEvent;
extern unsigned long systemStartTime;
extern bool otaInProgress;

// ============================================
// RFID DISABLE STATE
// ============================================

extern bool rfidDisabled;          // true = RFID reader ignores all cards
extern unsigned long rfidAutoEnableTime; // millis() timestamp to auto-re-enable, 0 = no timer

// ============================================
// SCHEDULED RESTART STATE
// ============================================

extern uint8_t scheduledRestartMode;       // 0=off, 1=at_hour, 2=every_hours
extern uint8_t scheduledRestartHour;       // 0-23 for at_hour mode
extern uint8_t scheduledRestartInterval;   // 1-24 hours for every_hours mode
extern unsigned long lastRestartCheckTime; // last millis() when we checked
extern bool ntpSynced;                     // NTP time sync status

// ============================================
// CONFIGURABLE PARAMETERS (3-tier redundancy)
// ============================================

extern unsigned long configuredAutoLockMs;  // auto-lock duration in ms
extern unsigned long preUnlockDelayMs;      // current card's pre-unlock delay in ms

// ============================================
// CLONE MODE STATE
// ============================================

extern CloneStep currentCloneStep;
extern byte cloneSourceUID[UID_MAX_SIZE];
extern byte cloneSourceSize;

// Clone result tracking (persists briefly after clone exits)
extern String cloneLastResult;       // "none", "success", "failed"
extern unsigned long cloneResultTime; // millis() when result was set

// ============================================
// NTP TIME HELPER
// ============================================

int getCurrentHour();  // Returns current hour (0-23) or -1 if NTP not synced

#endif // GLOBAL_STATE_H
