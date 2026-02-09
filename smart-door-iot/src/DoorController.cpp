#include "DoorController.h"
#include "GlobalState.h"

// ============================================
// DOOR CONTROL
// ============================================

void unlockDoor() {
    if (millis() - lastRelayToggle < RELAY_MIN_CYCLE_TIME) {
        DEBUG_PRINTLN("[DOOR] Relay cycle too fast, ignoring");
        return;
    }
    
    DEBUG_PRINTLN("[DOOR] Unlocking door...");
    
    // Yield untuk biarkan background tasks jalan
    yield();
    
    #if RELAY_INVERTED_LOGIC
        digitalWrite(RELAY_PIN, LOW);   // LOW = unlock (inverted logic)
    #else
        digitalWrite(RELAY_PIN, HIGH);  // HIGH = unlock (normal logic)
    #endif
    
    digitalWrite(LED_PIN, HIGH);
    doorUnlocked = true;
    lastRelayToggle = millis();
    stateStartTime = millis();
    
    lastEvent = "Door unlocked";
}

void lockDoor() {
    DEBUG_PRINTLN("[DOOR] Locking door...");
    
    #if RELAY_INVERTED_LOGIC
        digitalWrite(RELAY_PIN, HIGH);  // HIGH = lock (inverted logic)
    #else
        digitalWrite(RELAY_PIN, LOW);   // LOW = lock (normal logic)
    #endif
    
    digitalWrite(LED_PIN, LOW);
    doorUnlocked = false;
    lastRelayToggle = millis();
    
    // Reset RFID scan state sepenuhnya agar kartu bisa langsung di-tap lagi
    lastScanTime = 0;
    lastScannedSize = 0;
    // Clear lastScannedUID juga untuk keamanan
    for (byte i = 0; i < UID_MAX_SIZE; i++) {
        lastScannedUID[i] = 0;
    }
    
    lastEvent = "Door locked";
}
