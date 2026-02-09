#include "BuzzerController.h"
#include "GlobalState.h"

// ============================================
// BUZZER CONTROLLER
// ============================================

void playBuzzerPattern(BuzzerPattern pattern) {
    if (pattern == PATTERN_NONE) return;
    
    currentPattern = pattern;
    currentBeep = 0;
    buzzerStartTime = millis();
    buzzerState = false;
    
    DEBUG_PRINTF("[BUZZER] Playing pattern %d\n", pattern);
}

void updateBuzzer() {
    if (currentPattern == PATTERN_NONE) {
        digitalWrite(BUZZER_PIN, LOW);
        return;
    }
    
    const BuzzerPatternData& pattern = BUZZER_PATTERNS[currentPattern];
    
    if (currentBeep >= pattern.beepCount) {
        // Pattern finished
        digitalWrite(BUZZER_PIN, LOW);
        currentPattern = PATTERN_NONE;
        return;
    }
    
    unsigned long elapsed = millis() - buzzerStartTime;
    
    if (!buzzerState) {
        // Waiting for interval before next beep
        if (currentBeep == 0 || elapsed >= pattern.intervals[currentBeep - 1]) {
            // Start beep
            digitalWrite(BUZZER_PIN, HIGH);
            buzzerState = true;
            buzzerStartTime = millis();
        }
    } else {
        // Currently beeping
        if (elapsed >= pattern.beepDurations[currentBeep]) {
            // End beep
            digitalWrite(BUZZER_PIN, LOW);
            buzzerState = false;
            buzzerStartTime = millis();
            currentBeep++;
        }
    }
}
