#include "LEDController.h"
#include "GlobalState.h"

// ============================================
// SYSTEM LED CONTROLLER (built-in LED)
// ============================================

void updateLED() {
    unsigned long interval;
    
    switch (currentState) {
        case STATE_IDLE:
            interval = LED_BLINK_IDLE;
            break;
        case STATE_REGISTRATION_MODE:
        case STATE_CLONE_MODE:
            interval = LED_BLINK_REG_MODE;
            break;
        case STATE_ERROR:
            interval = LED_BLINK_ERROR;
            break;
        case STATE_UNLOCK:
            // LED stays on during unlock
            return;
        default:
            return;
    }
    
    if (millis() - lastLedToggle >= interval) {
        ledState = !ledState;
        digitalWrite(LED_PIN, ledState);
        lastLedToggle = millis();
    }
}

// ============================================
// RFID STATUS LED CONTROLLER
// ============================================

// RFID LED modes
enum RfidLedMode {
    RFID_LED_OFF = 0,
    RFID_LED_SUCCESS,    // Solid ON for 1 second
    RFID_LED_FAIL,       // Fast blink for 2 seconds
    RFID_LED_DELAY,      // Continuous flash during delay
    RFID_LED_DOOR_OPEN   // Solid ON while door is open (no timer)
};

static RfidLedMode rfidLedMode = RFID_LED_OFF;
static unsigned long rfidLedStartTime = 0;
static unsigned long rfidLedDurationMs = 0;
static bool rfidLedState = false;
static unsigned long rfidLedLastToggle = 0;

void rfidLedSuccess() {
    rfidLedMode = RFID_LED_SUCCESS;
    rfidLedStartTime = millis();
    rfidLedDurationMs = 1000;  // 1 second solid
    digitalWrite(RFID_LED_PIN, HIGH);
    rfidLedState = true;
}

void rfidLedFail() {
    rfidLedMode = RFID_LED_FAIL;
    rfidLedStartTime = millis();
    rfidLedDurationMs = 2000;  // 2 seconds fast blink
    rfidLedLastToggle = millis();
    digitalWrite(RFID_LED_PIN, HIGH);
    rfidLedState = true;
}

void rfidLedDelay(uint16_t delaySec) {
    rfidLedMode = RFID_LED_DELAY;
    rfidLedStartTime = millis();
    rfidLedDurationMs = (unsigned long)delaySec * 1000;
    rfidLedLastToggle = millis();
    rfidLedState = true;
    digitalWrite(RFID_LED_PIN, HIGH);  // Start ON for visibility
}

void rfidLedDoorOpen() {
    rfidLedMode = RFID_LED_DOOR_OPEN;
    rfidLedStartTime = millis();
    rfidLedDurationMs = 0;  // No auto-timeout
    digitalWrite(RFID_LED_PIN, HIGH);
    rfidLedState = true;
}

void rfidLedOff() {
    rfidLedMode = RFID_LED_OFF;
    digitalWrite(RFID_LED_PIN, LOW);
    rfidLedState = false;
}

void updateRfidLed() {
    if (rfidLedMode == RFID_LED_OFF) return;
    
    unsigned long elapsed = millis() - rfidLedStartTime;
    
    // Check if duration expired (skip for DOOR_OPEN mode which has no timer)
    if (rfidLedMode != RFID_LED_DOOR_OPEN && elapsed >= rfidLedDurationMs) {
        rfidLedMode = RFID_LED_OFF;
        digitalWrite(RFID_LED_PIN, LOW);
        rfidLedState = false;
        return;
    }
    
    switch (rfidLedMode) {
        case RFID_LED_SUCCESS:
            // Solid ON — already set in rfidLedSuccess()
            break;
            
        case RFID_LED_FAIL:
            // Fast blink: toggle every 80ms
            if (millis() - rfidLedLastToggle >= 80) {
                rfidLedState = !rfidLedState;
                digitalWrite(RFID_LED_PIN, rfidLedState);
                rfidLedLastToggle = millis();
            }
            break;
            
        case RFID_LED_DELAY:
            // Continuous flash: toggle every 200ms as delay indicator
            if (millis() - rfidLedLastToggle >= 200) {
                rfidLedState = !rfidLedState;
                digitalWrite(RFID_LED_PIN, rfidLedState);
                rfidLedLastToggle = millis();
            }
            break;
            
        case RFID_LED_DOOR_OPEN:
            // Solid ON — stays on until rfidLedOff() is called
            break;
            
        default:
            break;
    }
}
