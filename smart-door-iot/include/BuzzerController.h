#ifndef BUZZER_CONTROLLER_H
#define BUZZER_CONTROLLER_H

#include <Arduino.h>
#include "config.h"

// ============================================
// BUZZER CONTROLLER
// ============================================

void playBuzzerPattern(BuzzerPattern pattern);
void updateBuzzer();

#endif // BUZZER_CONTROLLER_H
