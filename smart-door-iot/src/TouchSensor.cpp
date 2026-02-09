#include "TouchSensor.h"
#include "GlobalState.h"

// ============================================
// TOUCH SENSOR (with anti false-trigger logic)
// ============================================

bool checkTouchSensor() {
    unsigned long currentTime = millis();
    bool currentReading = digitalRead(TOUCH_PIN);
    
    // Cooldown period - ignore touches for TOUCH_COOLDOWN_TIME after last trigger
    if (currentTime - lastTouchTrigger < TOUCH_COOLDOWN_TIME) {
        return false;
    }
    
    // Debouncing logic
    if (currentReading != lastTouchState) {
        touchDebounceStart = currentTime;
        touchStable = false;
        lastTouchState = currentReading;
        
        // Track when HIGH signal started
        if (currentReading == HIGH) {
            touchHighStart = currentTime;
        }
    } 
    else if (!touchStable && (currentTime - touchDebounceStart >= TOUCH_DEBOUNCE_TIME)) {
        touchStable = true;
    }
    
    // Check if touch has been held long enough (after debounce)
    if (touchStable && currentReading == HIGH && 
        (currentTime - touchHighStart >= TOUCH_MIN_HOLD_TIME)) {
        
        DEBUG_PRINTLN("[TOUCH] Touch sensor activated!");
        lastTouchTrigger = currentTime;  // Update cooldown timer
        touchStable = false;  // Reset for next touch
        return true;
    }
    
    return false;
}