#ifndef GLOBAL_STATE_H
#define GLOBAL_STATE_H

#include <Arduino.h>
#include <MFRC522.h>
#include <Preferences.h>
#include <ESPAsyncWebServer.h>
#include "config.h"

// ============================================
// GLOBAL OBJECTS
// ============================================

extern MFRC522 rfid;
extern Preferences nvs;
extern AsyncWebServer server;

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

#endif // GLOBAL_STATE_H
