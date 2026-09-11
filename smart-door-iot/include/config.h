#ifndef CONFIG_H
#define CONFIG_H

// Machine-specific credentials belong in the ignored config.local.h file.
// Copy config.local.h.example before building a real device.
#if __has_include("config.local.h")
#include "config.local.h"
#endif

// ============================================
// 📌 PIN DEFINITIONS (DO NOT CHANGE - from wiring.md)
// ============================================

// RFID MFRC522 (SPI)
#define RFID_SDA_PIN    5    // GPIO 5
#define RFID_RST_PIN    4    // GPIO 4
#define RFID_SCK_PIN    18   // GPIO 18 (SPI SCK)
#define RFID_MOSI_PIN   23   // GPIO 23 (SPI MOSI)
#define RFID_MISO_PIN   19   // GPIO 19 (SPI MISO)

// Actuators & Sensors
#define BUZZER_PIN      25   // GPIO 25
#define RELAY_PIN       32   // GPIO 32
#define LED_PIN         2    // GPIO 2 (Built-in LED)
#define RFID_LED_PIN    26   // GPIO 26 (RFID status LED)
#define TOUCH_PIN       33   // GPIO 33 (Touch Sensor TTP223B)

// Relay Configuration
// Set to true jika relay module active-LOW atau fail-safe solenoid
// Set to false jika relay module active-HIGH dengan fail-secure solenoid
#define RELAY_INVERTED_LOGIC    true    // true = HIGH untuk lock, LOW untuk unlock

// ============================================
// 🔐 MASTER CARD CONFIGURATION
// ============================================

// Jumlah master cards yang diizinkan
#define MAX_MASTER_CARDS 1

#ifndef MASTER_CARD_SIZE
#define MASTER_CARD_SIZE 4
#define MASTER_CARD_BYTE_0 0x00
#define MASTER_CARD_BYTE_1 0x00
#define MASTER_CARD_BYTE_2 0x00
#define MASTER_CARD_BYTE_3 0x00
#endif

// Master Card UIDs (Hardcoded)
// Format: {size, uid_bytes...}
// Example: 4-byte UID = {4, 0xDE, 0xAD, 0xBE, 0xEF}
// Cara mendapatkan UID: Upload code, tap kartu, lihat Serial Monitor

const byte MASTER_CARDS[MAX_MASTER_CARDS][8] = {
    {MASTER_CARD_SIZE, MASTER_CARD_BYTE_0, MASTER_CARD_BYTE_1, MASTER_CARD_BYTE_2, MASTER_CARD_BYTE_3, 0x00, 0x00, 0x00}
};

// ============================================
// 💾 NVS STORAGE CONFIGURATION
// ============================================

#define NVS_NAMESPACE       "doorlock"
#define NVS_USER_COUNT_KEY  "user_count"
#define NVS_USER_KEY_PREFIX "user_"

// Config NVS keys
#define NVS_AUTOLOCK_KEY    "autolock_dur"  // auto-lock duration in seconds (uint16)
// Card delay NVS: "d" + UID hex, e.g. "dBE0228DB" (max 15 chars)
// Card schedule NVS: "s" + UID hex, e.g. "sBE0228DB" (3 bytes: startH, endH, delaySec)
#define NVS_RFID_OFF_KEY    "rfid_off"     // RFID disabled flag (uint8: 0=enabled, 1=disabled)
#define NVS_SCHED_MODE_KEY  "sched_mode"   // Scheduled restart mode (0=off, 1=at_hour, 2=every_hours)
#define NVS_SCHED_HOUR_KEY  "sched_hour"   // Scheduled restart hour (0-23)
#define NVS_SCHED_INTV_KEY  "sched_intv"   // Scheduled restart interval in hours (1-24)

#define MAX_USER_CARDS      15   // Maximum 15 user cards
#define UID_MAX_SIZE        7    // Maximum UID size (4 or 7 bytes)

// ============================================
// ⏱️ TIMING CONFIGURATION
// ============================================

#define DEFAULT_UNLOCK_DURATION  5000    // 5 seconds default auto-lock
#define DEFAULT_CARD_DELAY      0       // 0ms default card delay (instant)
#define REGISTRATION_TIMEOUT    15000   // 15 seconds registration mode timeout
#define CLONE_TIMEOUT           30000   // 30 seconds clone mode timeout
#define TOUCH_DEBOUNCE_TIME     150     // 150ms touch sensor debounce (anti-noise)
#define TOUCH_MIN_HOLD_TIME     200     // 200ms minimum hold time (anti false-trigger)
#define TOUCH_COOLDOWN_TIME     1000    // 1 second cooldown after touch detected
#define RFID_COOLDOWN_TIME      1000    // 1 second cooldown between same card taps
#define RELAY_MIN_CYCLE_TIME    500     // 500ms minimum between relay cycles

// ============================================
// 📡 WIFI CONFIGURATION
// ============================================

#ifndef WIFI_SSID
#define WIFI_SSID           "CHANGE_ME_WIFI_SSID"
#endif
#ifndef WIFI_PASSWORD
#define WIFI_PASSWORD       "CHANGE_ME_WIFI_PASSWORD"
#endif

// Static IP Configuration (sesuai wiring.md)
#ifndef STATIC_IP_ADDR
#define STATIC_IP_ADDR      IPAddress(10, 10, 1, 5)
#endif
#ifndef GATEWAY_ADDR
#define GATEWAY_ADDR        IPAddress(10, 10, 1, 1)
#endif
#ifndef SUBNET_MASK
#define SUBNET_MASK         IPAddress(255, 255, 255, 0)
#endif

#define WIFI_CONNECT_TIMEOUT 10000      // 10 seconds WiFi connection timeout
#define WIFI_RECONNECT_INTERVAL 10000   // 10 seconds between reconnect attempts
#define WIFI_SERVER_RESTART_DELAY 1000  // 1 second delay before restarting web server after reconnect
#define WEB_SERVER_PORT      80

// ============================================
// 🕐 NTP CONFIGURATION
// ============================================

#define NTP_SERVER_1        "time.google.com"   // Google NTP (most reliable)
#define NTP_SERVER_2        "pool.ntp.org"
#define NTP_TIMEZONE        "WIB-7"             // POSIX TZ string for GMT+7 (WIB)
#define NTP_RESYNC_INTERVAL 1800000     // Re-check NTP every 30 minutes (ms)

// ============================================
//  OTA CONFIGURATION
// ============================================

#ifndef OTA_PASSWORD
#define OTA_PASSWORD        "CHANGE_ME_OTA_PASSWORD"
#endif
#ifndef OTA_WEB_USERNAME
#define OTA_WEB_USERNAME    "admin"
#endif
#ifndef OTA_WEB_PASSWORD
#define OTA_WEB_PASSWORD    "CHANGE_ME_OTA_WEB_PASSWORD"
#endif

// ============================================
// 📡 MQTT CONFIGURATION
// ============================================

// EMQX Cloud settings — UPDATE THESE with your EMQX Cloud deployment details
// Get connection address from: https://cloud-intl.emqx.com/ → Deployment → Overview
#ifndef MQTT_SERVER
#define MQTT_SERVER         "mqtt.example.com"
#endif
#define MQTT_PORT           8883                 // EMQX Cloud always uses 8883 (MQTTS/TLS)
#ifndef MQTT_USERNAME
#define MQTT_USERNAME       "CHANGE_ME_MQTT_USERNAME"
#endif
#ifndef MQTT_PASSWORD
#define MQTT_PASSWORD       "CHANGE_ME_MQTT_PASSWORD"
#endif
#ifndef MQTT_CLIENT_ID
#define MQTT_CLIENT_ID      "smartdoor-esp32"
#endif
#define MQTT_USE_TLS        1                    // MUST be 1 for EMQX Cloud (TLS required)
#define MQTT_BUFFER_SIZE    16384                // 16KB buffer for OTA chunks
// Note: MQTT_KEEPALIVE is defined by PubSubClient.h (default 15s)
// We override it before including PubSubClient in MQTTHandler.h
#define MQTT_KEEPALIVE_SEC  60                   // Keep-alive interval (seconds)

// Legacy API key (used by web server for authentication)
#ifndef API_KEY
#define API_KEY             "CHANGE_ME_API_KEY"
#endif
#define API_KEY_HEADER      "X-API-Key"          // Header name for API key

// ============================================
// �🔊 BUZZER PATTERNS
// ============================================

// Pattern IDs
enum BuzzerPattern {
    PATTERN_INIT_OK = 0,        // Startup success: 2 beeps
    PATTERN_INIT_FAIL,          // Startup fail: 1 long beep
    PATTERN_VALID_CARD,         // Valid card: 1 short beep
    PATTERN_INVALID_CARD,       // Invalid card: 1 long beep
    PATTERN_ENTER_REG_MODE,     // Enter registration: rapid beeps
    PATTERN_ADD_SUCCESS,        // Card added: 2 short beeps
    PATTERN_REMOVE_SUCCESS,     // Card removed: 1 long + 1 short
    PATTERN_TIMEOUT_EXIT,       // Mode timeout: 1 long beep
    PATTERN_TOUCH_EXIT,         // Touch sensor: 1 short beep
    PATTERN_EXIT_REG_MODE,      // Manual exit registration: 2 beeps
    PATTERN_DELAY_CARD,         // Delayed card: 1 long beep (2 seconds)
    PATTERN_RFID_DISABLED,      // RFID disabled/enabled: 5 rapid beeps
    PATTERN_NONE                // No pattern playing
};

// Buzzer timing patterns (in milliseconds)
// Format: {beep_count, {durations...}, {intervals...}}

struct BuzzerPatternData {
    uint8_t beepCount;
    uint16_t beepDurations[5];  // Up to 5 beeps per pattern
    uint16_t intervals[5];       // Intervals between beeps
};

const BuzzerPatternData BUZZER_PATTERNS[] = {
    // PATTERN_INIT_OK: 2 short beeps
    {2, {100, 100, 0, 0, 0}, {0, 100, 0, 0, 0}},
    
    // PATTERN_INIT_FAIL: 1 long beep
    {1, {500, 0, 0, 0, 0}, {0, 0, 0, 0, 0}},
    
    // PATTERN_VALID_CARD: 1 short beep
    {1, {100, 0, 0, 0, 0}, {0, 0, 0, 0, 0}},
    
    // PATTERN_INVALID_CARD: 1 long beep
    {1, {500, 0, 0, 0, 0}, {0, 0, 0, 0, 0}},
    
    // PATTERN_ENTER_REG_MODE: 3 rapid short beeps
    {3, {80, 80, 80, 0, 0}, {0, 80, 80, 0, 0}},
    
    // PATTERN_ADD_SUCCESS: 2 short beeps
    {2, {100, 100, 0, 0, 0}, {0, 100, 0, 0, 0}},
    
    // PATTERN_REMOVE_SUCCESS: 1 long + 1 short
    {2, {300, 100, 0, 0, 0}, {0, 100, 0, 0, 0}},
    
    // PATTERN_TIMEOUT_EXIT: 1 long beep
    {1, {400, 0, 0, 0, 0}, {0, 0, 0, 0, 0}},
    
    // PATTERN_TOUCH_EXIT: 1 short beep
    {1, {80, 0, 0, 0, 0}, {0, 0, 0, 0, 0}},
    
    // PATTERN_EXIT_REG_MODE: 2 short beeps (manual exit)
    {2, {100, 100, 0, 0, 0}, {0, 150, 0, 0, 0}},
    
    // PATTERN_DELAY_CARD: 1 long beep (2 seconds) for delayed unlock
    {1, {2000, 0, 0, 0, 0}, {0, 0, 0, 0, 0}},
    
    // PATTERN_RFID_DISABLED: 5 rapid short beeps
    {5, {60, 60, 60, 60, 60}, {0, 60, 60, 60, 60}}
};

// ============================================
// 🎨 LED BLINK PATTERNS
// ============================================

#define LED_BLINK_IDLE          1000    // Slow blink in IDLE (1 sec)
#define LED_BLINK_REG_MODE      200     // Fast blink in REG_MODE (200ms)
#define LED_BLINK_ERROR         50      // Very fast blink on ERROR

// ============================================
// 🐛 DEBUG CONFIGURATION
// ============================================

#define DEBUG_SERIAL            true    // Enable serial debug output
#define SERIAL_BAUD_RATE        115200

#if DEBUG_SERIAL
    #define DEBUG_PRINT(x)      Serial.print(x)
    #define DEBUG_PRINTLN(x)    Serial.println(x)
    #define DEBUG_PRINTF(...)   Serial.printf(__VA_ARGS__)
#else
    #define DEBUG_PRINT(x)
    #define DEBUG_PRINTLN(x)
    #define DEBUG_PRINTF(...)
#endif

#endif // CONFIG_H
