#include "GlobalState.h"

// ============================================
// GLOBAL OBJECTS
// ============================================

MFRC522 rfid(RFID_SDA_PIN, RFID_RST_PIN);
Preferences nvs;
AsyncWebServer server(WEB_SERVER_PORT);

// ============================================
// STATE MACHINE
// ============================================

SystemState currentState = STATE_IDLE;
unsigned long stateStartTime = 0;
unsigned long lastActivityTime = 0;

// ============================================
// DOOR & RELAY STATE
// ============================================

bool doorUnlocked = false;
unsigned long lastRelayToggle = 0;

// ============================================
// RFID CARD DATA
// ============================================

CardUID userCards[MAX_USER_CARDS];
uint8_t userCardCount = 0;

byte lastScannedUID[UID_MAX_SIZE];
byte lastScannedSize = 0;
unsigned long lastScanTime = 0;

// ============================================
// BUZZER STATE
// ============================================

BuzzerPattern currentPattern = PATTERN_NONE;
uint8_t currentBeep = 0;
unsigned long buzzerStartTime = 0;
bool buzzerState = false;

// ============================================
// TOUCH SENSOR STATE
// ============================================

bool lastTouchState = false;
unsigned long touchDebounceStart = 0;
bool touchStable = false;
unsigned long touchHighStart = 0;
unsigned long lastTouchTrigger = 0;

// ============================================
// LED STATE
// ============================================

unsigned long lastLedToggle = 0;
bool ledState = false;

// ============================================
// WIFI & WEB STATE
// ============================================

bool wifiConnected = false;
String lastCardUID = "None";
String lastEvent = "System started";
unsigned long systemStartTime = 0;
bool otaInProgress = false;

// ============================================
// CONFIGURABLE PARAMETERS
// ============================================

unsigned long configuredAutoLockMs = DEFAULT_UNLOCK_DURATION;  // default 5000ms
unsigned long preUnlockDelayMs = 0;                            // set per card scan

// ============================================
// CLONE MODE STATE
// ============================================

CloneStep currentCloneStep = CLONE_WAIT_SOURCE;
byte cloneSourceUID[UID_MAX_SIZE] = {0};
byte cloneSourceSize = 0;

// Clone result tracking
String cloneLastResult = "none";
unsigned long cloneResultTime = 0;
