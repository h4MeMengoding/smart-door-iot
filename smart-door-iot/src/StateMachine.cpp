#include "StateMachine.h"
#include "GlobalState.h"
#include "TouchSensor.h"
#include "RFIDReader.h"
#include "CardManager.h"
#include "BuzzerController.h"
#include "LEDController.h"
#include "DoorController.h"
#include "APIHandler.h"

// ============================================
// HELPER: Get card delay from NVS
// ============================================

static unsigned long getCardDelayMs(byte* uid, byte size) {
    // Build NVS key: "d" + UID hex, e.g. "dBE0228DB"
    String key = "d";
    for (byte i = 0; i < size; i++) {
        if (uid[i] < 0x10) key += "0";
        key += String(uid[i], HEX);
    }
    key.toUpperCase();
    
    // NVS key max 15 chars — should be fine for 4-7 byte UIDs
    if (key.length() > 15) {
        key = key.substring(0, 15);
    }
    
    // Check time-based schedule first
    int currentHr = getCurrentHour();
    if (currentHr >= 0) {
        // Build schedule NVS key: "s" + UID hex
        String schedKey = "s";
        for (byte i = 0; i < size; i++) {
            if (uid[i] < 0x10) schedKey += "0";
            schedKey += String(uid[i], HEX);
        }
        schedKey.toUpperCase();
        if (schedKey.length() > 15) schedKey = schedKey.substring(0, 15);
        
        // Read schedule: 3 bytes [startHour, endHour, delaySec]
        uint8_t schedData[3] = {0};
        size_t schedLen = nvs.getBytesLength(schedKey.c_str());
        DEBUG_PRINTF("[AUTH] Schedule key '%s': len=%d, currentHr=%d\n", schedKey.c_str(), (int)schedLen, currentHr);
        if (schedLen == 3) {
            nvs.getBytes(schedKey.c_str(), schedData, 3);
            uint8_t startH = schedData[0];
            uint8_t endH = schedData[1];
            uint8_t schedDelay = schedData[2];
            
            bool inRange = false;
            if (startH <= endH) {
                // Normal range: e.g. 8-17
                inRange = (currentHr >= startH && currentHr < endH);
            } else {
                // Wrapping range: e.g. 22-8 means 22,23,0,1,...,7
                inRange = (currentHr >= startH || currentHr < endH);
            }
            
            DEBUG_PRINTF("[AUTH] Schedule %02d:00-%02d:00 delay=%us inRange=%s\n", startH, endH, schedDelay, inRange ? "YES" : "no");
            if (inRange) {
                return (unsigned long)schedDelay * 1000;
            }
        }
    } else {
        DEBUG_PRINTLN("[AUTH] NTP not synced — schedule check skipped, using static delay");
    }
    
    // Fall back to static delay
    uint16_t delaySec = nvs.getUShort(key.c_str(), 0);
    return (unsigned long)delaySec * 1000;
}

// ============================================
// STATE MACHINE
// ============================================

void handleStateIdle() {
    // Check touch sensor
    if (checkTouchSensor()) {
        DEBUG_PRINTLN("\n[STATE] Touch sensor pressed -> UNLOCK");
        playBuzzerPattern(PATTERN_TOUCH_EXIT);
        rfidLedDoorOpen();  // RFID LED: solid ON while door open
        unlockDoor();
        currentState = STATE_UNLOCK;
        lastEvent = "Touch sensor exit";
        
        // Broadcast to WebSocket so web dashboard syncs
        if (wifiConnected) {
            broadcastDoorStatus();
        }
        return;
    }
    
    // Skip RFID check if disabled
    if (rfidDisabled) {
        return;
    }
    
    // Check RFID
    byte uid[UID_MAX_SIZE];
    byte size;
    
    if (readCard(uid, &size)) {
        if (isNewCardScan(uid, size)) {
            lastCardUID = uidToString(uid, size);
            DEBUG_PRINTF("\n[STATE] Card detected: %s\n", lastCardUID.c_str());
            currentState = STATE_AUTH_CHECK;
            stateStartTime = millis();
        }
    }
}

void handleStateAuthCheck() {
    byte uid[UID_MAX_SIZE];
    byte size;
    
    // Copy last scanned card
    size = lastScannedSize;
    for (byte i = 0; i < size; i++) {
        uid[i] = lastScannedUID[i];
    }
    
    // Check if master card
    if (isMasterCard(uid, size)) {
        DEBUG_PRINTLN("[AUTH] Master card detected -> REGISTRATION_MODE");
        playBuzzerPattern(PATTERN_ENTER_REG_MODE);
        currentState = STATE_REGISTRATION_MODE;
        stateStartTime = millis();
        lastActivityTime = millis();
        lastEvent = "Master card - Registration mode";
        
        // Broadcast registration mode to web
        if (wifiConnected) {
            broadcastRegistrationMode(true);
            broadcastDoorStatus();
        }
        return;
    }
    
    // Check if registered user card
    if (isCardRegistered(uid, size)) {
        
        // Check card-specific delay
        unsigned long cardDelay = getCardDelayMs(uid, size);
        
        if (cardDelay > 0) {
            // Delay before unlock — single 2-second beep + LED flash during delay
            DEBUG_PRINTF("[AUTH] Valid card with %lums delay -> PRE_UNLOCK\n", cardDelay);
            playBuzzerPattern(PATTERN_DELAY_CARD);  // 2-second beep at start only
            rfidLedDelay(cardDelay / 1000);  // RFID LED: flash during delay
            preUnlockDelayMs = cardDelay;
            currentState = STATE_PRE_UNLOCK;
            stateStartTime = millis();
            lastEvent = "Delay unlock: " + lastCardUID;
        } else {
            // Instant unlock
            DEBUG_PRINTLN("[AUTH] Valid user card -> UNLOCK");
            playBuzzerPattern(PATTERN_VALID_CARD);
            rfidLedDoorOpen();  // RFID LED: solid ON while door open
            unlockDoor();
            currentState = STATE_UNLOCK;
            stateStartTime = millis();
            lastEvent = "Valid card: " + lastCardUID;
        }
        
        // Broadcast to WebSocket clients
        if (wifiConnected) {
            broadcastCardScan(lastCardUID, true);
            broadcastDoorStatus();
        }
        return;
    }
    
    // Invalid card
    DEBUG_PRINTLN("[AUTH] Invalid card -> IDLE");
    playBuzzerPattern(PATTERN_INVALID_CARD);
    rfidLedFail();  // RFID LED: fast blink 2 seconds
    currentState = STATE_IDLE;
    lastScanTime = 0;  // Reset cooldown so next tap is always accepted
    lastEvent = "Invalid card: " + lastCardUID;
    
    // Broadcast to WebSocket clients
    if (wifiConnected) {
        broadcastCardScan(lastCardUID, false);
    }
}

void handleStateUnlock() {
    unsigned long elapsed = millis() - stateStartTime;
    
    if (elapsed >= configuredAutoLockMs) {
        DEBUG_PRINTLN("[STATE] Auto-lock timeout -> IDLE");
        rfidLedOff();  // Turn off RFID LED when door locks
        lockDoor();
        currentState = STATE_IDLE;
        lastScanTime = 0;  // Reset cooldown so next card tap is fresh
        
        // Broadcast to WebSocket so web dashboard syncs
        if (wifiConnected) {
            broadcastDoorStatus();
        }
    }
}

void handleStatePreUnlock() {
    unsigned long elapsed = millis() - stateStartTime;
    
    // LED D26 flashes during delay (handled by updateRfidLed)
    // Buzzer already played 2-second beep at start in handleStateAuthCheck
    
    if (elapsed >= preUnlockDelayMs) {
        DEBUG_PRINTLN("[STATE] Pre-unlock delay elapsed -> UNLOCK");
        rfidLedDoorOpen();  // RFID LED: solid ON while door open
        unlockDoor();
        currentState = STATE_UNLOCK;
        stateStartTime = millis();
        lastEvent = "Valid card: " + lastCardUID;
        
        // Broadcast to WebSocket
        if (wifiConnected) {
            broadcastDoorStatus();
        }
    }
}

void handleStateRegistrationMode() {
    // Check timeout
    if (millis() - lastActivityTime >= REGISTRATION_TIMEOUT) {
        DEBUG_PRINTLN("[STATE] Registration mode timeout -> IDLE");
        playBuzzerPattern(PATTERN_TIMEOUT_EXIT);
        currentState = STATE_IDLE;
        lastScanTime = 0;  // Reset cooldown
        lastEvent = "Registration mode timeout";
        if (wifiConnected) {
            broadcastRegistrationMode(false);
            broadcastDoorStatus();
        }
        return;
    }
    
    // Check touch sensor for manual exit
    if (checkTouchSensor()) {
        DEBUG_PRINTLN("[STATE] Touch sensor pressed, exiting registration mode -> IDLE");
        playBuzzerPattern(PATTERN_EXIT_REG_MODE);
        currentState = STATE_IDLE;
        lastScanTime = 0;  // Reset cooldown
        lastEvent = "Registration mode exited (touch)";
        if (wifiConnected) {
            broadcastRegistrationMode(false);
            broadcastDoorStatus();
        }
        return;
    }
    
    // Check for card tap
    byte uid[UID_MAX_SIZE];
    byte size;
    
    if (readCard(uid, &size)) {
        if (isNewCardScan(uid, size)) {
            lastActivityTime = millis();
            String cardStr = uidToString(uid, size);
            
            // Check if master card - exit registration mode
            if (isMasterCard(uid, size)) {
                DEBUG_PRINTLN("[REG] Master card tapped, exiting registration mode -> IDLE");
                playBuzzerPattern(PATTERN_EXIT_REG_MODE);
                currentState = STATE_IDLE;
                lastScanTime = 0;  // Reset cooldown
                lastEvent = "Registration mode exited (master card)";
                if (wifiConnected) {
                    broadcastRegistrationMode(false);
                    broadcastDoorStatus();
                }
                return;
            }
            
            // Check if card already registered
            if (isCardRegistered(uid, size)) {
                // Remove card
                DEBUG_PRINTF("[REG] Removing card: %s\n", cardStr.c_str());
                if (removeCardFromNVS(uid, size)) {
                    playBuzzerPattern(PATTERN_REMOVE_SUCCESS);
                    lastEvent = "Card removed: " + cardStr;
                    // Broadcast card removed to web instantly
                    if (wifiConnected) {
                        broadcastCardRemoved(cardStr);
                        broadcastDoorStatus();
                    }
                } else {
                    playBuzzerPattern(PATTERN_INVALID_CARD);
                    lastEvent = "Failed to remove card";
                }
            } else {
                // Add card
                DEBUG_PRINTF("[REG] Adding card: %s\n", cardStr.c_str());
                if (addCardToNVS(uid, size)) {
                    playBuzzerPattern(PATTERN_ADD_SUCCESS);
                    lastEvent = "Card added: " + cardStr;
                    // Broadcast card added to web instantly
                    if (wifiConnected) {
                        broadcastCardAdded(cardStr);
                        broadcastDoorStatus();
                    }
                } else {
                    playBuzzerPattern(PATTERN_INVALID_CARD);
                    lastEvent = "Card storage full";
                }
            }
        }
    }
}

// ============================================
// STATE: CLONE MODE (UID Clone via Serial)
// ============================================

void handleStateCloneMode() {
    // Check timeout
    if (millis() - lastActivityTime >= CLONE_TIMEOUT) {
        DEBUG_PRINTLN("[CLONE] Timeout -> IDLE");
        playBuzzerPattern(PATTERN_TIMEOUT_EXIT);
        currentState = STATE_IDLE;
        lastScanTime = 0;  // Reset cooldown
        lastEvent = "Clone mode timeout";
        broadcastCloneStatus("TIMEOUT", "", "timeout");
        broadcastDoorStatus();
        return;
    }

    // Check touch sensor for exit
    if (checkTouchSensor()) {
        DEBUG_PRINTLN("[CLONE] Touch exit -> IDLE");
        playBuzzerPattern(PATTERN_EXIT_REG_MODE);
        currentState = STATE_IDLE;
        lastEvent = "Clone mode exited (touch)";
        broadcastCloneStatus("CANCELLED");
        broadcastDoorStatus();
        return;
    }

    // Check Serial for "exit" command
    if (Serial.available()) {
        String cmd = Serial.readStringUntil('\n');
        cmd.trim();
        if (cmd == "exit") {
            DEBUG_PRINTLN("[CLONE] Exit command -> IDLE");
            playBuzzerPattern(PATTERN_EXIT_REG_MODE);
            currentState = STATE_IDLE;
            lastEvent = "Clone mode exited (serial)";
            broadcastCloneStatus("CANCELLED");
            broadcastDoorStatus();
            return;
        }
    }

    // === STEP 1: Wait for SOURCE card ===
    if (currentCloneStep == CLONE_WAIT_SOURCE) {
        byte uid[UID_MAX_SIZE];
        byte size;

        if (readCard(uid, &size)) {
            if (isNewCardScan(uid, size)) {
                // Master cards are now allowed as clone source

                // Only support 4-byte UID (Mifare Classic)
                if (size != 4) {
                    DEBUG_PRINTF("[CLONE] UID %d byte tidak didukung. Hanya 4-byte UID.\n", size);
                    playBuzzerPattern(PATTERN_INVALID_CARD);
                    lastActivityTime = millis();
                    return;
                }

                // Store source UID
                cloneSourceSize = size;
                for (byte i = 0; i < size; i++) {
                    cloneSourceUID[i] = uid[i];
                }

                String srcStr = uidToString(uid, size);
                DEBUG_PRINTF("\n[CLONE] Source UID: %s\n", srcStr.c_str());
                DEBUG_PRINTLN("[CLONE] Step 2: Tap TARGET card (Chinese magic card)...");
                DEBUG_PRINTLN("[CLONE] Touch sensor atau ketik 'exit' untuk batal\n");

                playBuzzerPattern(PATTERN_VALID_CARD);
                currentCloneStep = CLONE_WAIT_TARGET;
                lastActivityTime = millis();
                lastScanTime = 0;  // Reset cooldown

                // Broadcast source card captured
                broadcastCloneStatus("WAIT_TARGET", srcStr);
            }
        }
    }
    // === STEP 2: Wait for TARGET card & write ===
    else if (currentCloneStep == CLONE_WAIT_TARGET) {
        // Use raw MFRC522 functions - keep card active for writing
        if (!rfid.PICC_IsNewCardPresent()) return;
        if (!rfid.PICC_ReadCardSerial()) return;

        lastActivityTime = millis();

        byte targetSize = rfid.uid.size;
        byte targetUID[UID_MAX_SIZE];
        for (byte i = 0; i < targetSize; i++) {
            targetUID[i] = rfid.uid.uidByte[i];
        }

        // Don't write to the same card
        if (compareUID(targetUID, targetSize, cloneSourceUID, cloneSourceSize)) {
            DEBUG_PRINTLN("[CLONE] Kartu sama dengan source! Gunakan kartu lain.");
            playBuzzerPattern(PATTERN_INVALID_CARD);
            rfid.PICC_HaltA();
            rfid.PCD_StopCrypto1();
            lastScanTime = 0;
            return;
        }

        String targetStr = uidToString(targetUID, targetSize);
        String srcStr = uidToString(cloneSourceUID, cloneSourceSize);
        DEBUG_PRINTF("[CLONE] Target detected: %s\n", targetStr.c_str());
        DEBUG_PRINTF("[CLONE] Writing UID %s -> target...\n", srcStr.c_str());

        // Try to write UID (only works on Chinese magic cards)
        if (rfid.MIFARE_SetUid(cloneSourceUID, (byte)cloneSourceSize, true)) {
            rfid.PICC_HaltA();
            rfid.PCD_StopCrypto1();

            DEBUG_PRINTLN("\n[CLONE] =============================");
            DEBUG_PRINTF("[CLONE] SUKSES! UID di-clone: %s\n", srcStr.c_str());
            DEBUG_PRINTLN("[CLONE] =============================\n");

            playBuzzerPattern(PATTERN_ADD_SUCCESS);
            rfidLedSuccess();
            lastEvent = "UID cloned: " + srcStr;
            cloneLastResult = "success";
            cloneResultTime = millis();
            broadcastCloneStatus("DONE", srcStr, "success");
        } else {
            rfid.PICC_HaltA();
            rfid.PCD_StopCrypto1();

            DEBUG_PRINTLN("\n[CLONE] GAGAL! Kartu tidak support UID writing.");
            DEBUG_PRINTLN("[CLONE] Hanya Chinese magic card (Gen1a/Gen2) yang didukung.\n");

            playBuzzerPattern(PATTERN_INVALID_CARD);
            rfidLedFail();
            lastEvent = "Clone failed: not magic card";
            cloneLastResult = "failed";
            cloneResultTime = millis();
            broadcastCloneStatus("DONE", srcStr, "failed");
        }

        // Exit clone mode
        currentState = STATE_IDLE;
        DEBUG_PRINTLN("[CLONE] Kembali ke IDLE");
        broadcastDoorStatus();
    }
}
