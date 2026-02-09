#ifndef STATE_MACHINE_H
#define STATE_MACHINE_H

#include <Arduino.h>

// ============================================
// STATE MACHINE
// ============================================

void handleStateIdle();
void handleStateAuthCheck();
void handleStatePreUnlock();
void handleStateUnlock();
void handleStateRegistrationMode();
void handleStateCloneMode();

#endif // STATE_MACHINE_H
