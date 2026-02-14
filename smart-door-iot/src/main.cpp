/*
 * ========================================
 * SMART DOOR LOCK SYSTEM
 * ========================================
 * ESP32-based door lock with RFID authentication
 * Touch sensor exit, master card management
 * WiFi monitoring
 * 
 * Hardware:
 * - ESP32 DevKit V1 (30-pin)
 * - MFRC522 RFID Reader
 * - Solenoid Lock 12V via Relay
 * - Touch Sensor TTP223B
 * - Active Buzzer
 * 
 * Author: Smart Door Lock Project
 * Date: February 2026
 * ========================================
 */

#include <Arduino.h>
#include <ArduinoOTA.h>
#include "config.h"
#include "GlobalState.h"
#include "CardManager.h"
#include "RFIDReader.h"
#include "BuzzerController.h"
#include "LEDController.h"
#include "DoorController.h"
#include "TouchSensor.h"
#include "WiFiManager.h"
#include "APIHandler.h"
#include "StateMachine.h"

// ============================================
// SETUP
// ============================================

void setup() {
    // Initialize serial
    Serial.begin(SERIAL_BAUD_RATE);
    delay(500);
    
    DEBUG_PRINTLN("\n\n========================================");
    DEBUG_PRINTLN("    SMART DOOR LOCK SYSTEM");
    DEBUG_PRINTLN("========================================\n");
    
    systemStartTime = millis();
    
    // Initialize pins
    DEBUG_PRINTLN("[INIT] Configuring GPIO pins...");
    pinMode(BUZZER_PIN, OUTPUT);
    pinMode(RELAY_PIN, OUTPUT);
    pinMode(LED_PIN, OUTPUT);
    pinMode(RFID_LED_PIN, OUTPUT);
    pinMode(TOUCH_PIN, INPUT_PULLDOWN);
    
    digitalWrite(BUZZER_PIN, LOW);
    
    // Initialize relay to LOCKED state
    #if RELAY_INVERTED_LOGIC
        digitalWrite(RELAY_PIN, HIGH);  // HIGH = locked (inverted logic)
        DEBUG_PRINTLN("[INIT] Relay initialized: INVERTED logic (HIGH=locked)");
    #else
        digitalWrite(RELAY_PIN, LOW);   // LOW = locked (normal logic)
        DEBUG_PRINTLN("[INIT] Relay initialized: NORMAL logic (LOW=locked)");
    #endif
    
    digitalWrite(LED_PIN, LOW);
    digitalWrite(RFID_LED_PIN, LOW);
    
    DEBUG_PRINTLN("[INIT] GPIO pins configured");
    
    // Initialize NVS
    initNVS();
    loadCardsFromNVS();
    
    // Load configurable parameters from NVS (tier 2: NVS backup)
    {
        uint16_t savedAutoLock = nvs.getUShort(NVS_AUTOLOCK_KEY, 0);
        if (savedAutoLock > 0 && savedAutoLock <= 60) {
            configuredAutoLockMs = (unsigned long)savedAutoLock * 1000;
            DEBUG_PRINTF("[INIT] Auto-lock from NVS: %us\n", savedAutoLock);
        } else {
            configuredAutoLockMs = DEFAULT_UNLOCK_DURATION;
            DEBUG_PRINTF("[INIT] Auto-lock from default: %ums\n", DEFAULT_UNLOCK_DURATION);
        }
        
        // Load RFID disabled state
        rfidDisabled = nvs.getUChar(NVS_RFID_OFF_KEY, 0) == 1;
        if (rfidDisabled) {
            DEBUG_PRINTLN("[INIT] RFID is DISABLED (from NVS)");
        }
        
        // Load scheduled restart config
        scheduledRestartMode = nvs.getUChar(NVS_SCHED_MODE_KEY, 0);
        scheduledRestartHour = nvs.getUChar(NVS_SCHED_HOUR_KEY, 0);
        scheduledRestartInterval = nvs.getUChar(NVS_SCHED_INTV_KEY, 0);
        if (scheduledRestartMode > 0) {
            DEBUG_PRINTF("[INIT] Scheduled restart: mode=%d hour=%d interval=%dh\n",
                        scheduledRestartMode, scheduledRestartHour, scheduledRestartInterval);
        }
    }
    
    // Initialize RFID
    if (!initRFID()) {
        DEBUG_PRINTLN("[INIT] WARNING: Continuing without RFID");
        currentState = STATE_ERROR;
    }
    
    // Initialize WiFi
    setupWiFi();
    setupOTA();
    setupWebServer();
    
    // System ready
    DEBUG_PRINTLN("\n========================================");
    DEBUG_PRINTLN(" SYSTEM READY");
    DEBUG_PRINTLN("========================================");
    DEBUG_PRINTF("State: %s\n", "IDLE");
    DEBUG_PRINTF("Registered cards: %d/%d\n", userCardCount, MAX_USER_CARDS);
    DEBUG_PRINTF("WiFi: %s\n", wifiConnected ? "Connected" : "Offline");
    if (wifiConnected) {
        DEBUG_PRINTF("Dashboard: http://%s\n", WiFi.localIP().toString().c_str());
    }
    DEBUG_PRINTLN("========================================\n");
    
    currentState = STATE_IDLE;
    lastEvent = "System ready";
}

// ============================================
// MAIN LOOP
// ============================================

void loop() {
    // Handle OTA update (prioritas tertinggi)
    if (wifiConnected) {
        ArduinoOTA.handle();
    }
    
    // Jika OTA sedang berlangsung, skip semua logic lain
    if (otaInProgress) {
        return;
    }
    
    // Yield dulu untuk WiFi/AsyncWebServer background tasks
    yield();
    
    // Handle WebSocket cleanup
    if (wifiConnected) {
        handleWebSocketTasks();
    }
    
    // Update non-blocking components
    updateBuzzer();
    updateRfidLed();
    if (currentState != STATE_UNLOCK) {
        updateLED();
    }
    
    // Handle Serial commands (clone mode trigger)
    if (Serial.available() && currentState == STATE_IDLE) {
        String cmd = Serial.readStringUntil('\n');
        cmd.trim();
        if (cmd == "clone") {
            DEBUG_PRINTLN("\n[CLONE] =============================");
            DEBUG_PRINTLN("[CLONE]   UID CLONE MODE");
            DEBUG_PRINTLN("[CLONE] =============================");
            DEBUG_PRINTLN("[CLONE] Step 1: Tap SOURCE card (kartu yg mau di-copy)...");
            DEBUG_PRINTLN("[CLONE] Touch sensor atau ketik 'exit' untuk batal\n");
            playBuzzerPattern(PATTERN_ENTER_REG_MODE);
            currentCloneStep = CLONE_WAIT_SOURCE;
            currentState = STATE_CLONE_MODE;
            lastActivityTime = millis();
            lastScanTime = 0;
            lastEvent = "Clone mode activated";
        }
    }

    // Scheduled restart check (every 60 seconds)
    if (scheduledRestartMode > 0 && wifiConnected && currentState == STATE_IDLE) {
        unsigned long now = millis();
        if (now - lastRestartCheckTime >= 60000) {
            lastRestartCheckTime = now;
            
            if (scheduledRestartMode == 1) {
                // Mode 1: Restart at specific hour
                int currentHr = getCurrentHour();
                if (currentHr >= 0 && currentHr == scheduledRestartHour) {
                    // Only restart once per hour (check uptime > 120s to avoid restart loop)
                    unsigned long uptimeSec = (now - systemStartTime) / 1000;
                    if (uptimeSec > 120) {
                        DEBUG_PRINTF("[Schedule] Restarting at hour %d\n", currentHr);
                        lastEvent = "Scheduled restart (at hour)";
                        lockDoor();
                        delay(1000);
                        ESP.restart();
                    }
                }
            } else if (scheduledRestartMode == 2) {
                // Mode 2: Restart every N hours
                unsigned long uptimeSec = (now - systemStartTime) / 1000;
                unsigned long intervalSec = (unsigned long)scheduledRestartInterval * 3600;
                if (uptimeSec >= intervalSec) {
                    DEBUG_PRINTF("[Schedule] Restarting after %d hours\n", scheduledRestartInterval);
                    lastEvent = "Scheduled restart (interval)";
                    lockDoor();
                    delay(1000);
                    ESP.restart();
                }
            }
        }
    }

    // State machine
    switch (currentState) {
        case STATE_IDLE:
            handleStateIdle();
            break;
            
        case STATE_AUTH_CHECK:
            handleStateAuthCheck();
            break;
            
        case STATE_PRE_UNLOCK:
            handleStatePreUnlock();
            break;
            
        case STATE_UNLOCK:
            handleStateUnlock();
            break;
            
        case STATE_REGISTRATION_MODE:
            handleStateRegistrationMode();
            break;

        case STATE_CLONE_MODE:
            handleStateCloneMode();
            break;
            
        case STATE_ERROR:
            // Stay in error state, manual reset required
            break;
    }
    
    // Delay kecil untuk prevent watchdog timeout + stabilkan loop
    delay(10);
}
