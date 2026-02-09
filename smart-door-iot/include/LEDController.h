#ifndef LED_CONTROLLER_H
#define LED_CONTROLLER_H

#include <Arduino.h>

// ============================================
// LED CONTROLLER
// ============================================

void updateLED();

// RFID Status LED functions
void rfidLedSuccess();          // Solid 1 second on success
void rfidLedFail();             // Fast blink for 2 seconds on fail
void rfidLedDelay(uint16_t delaySec);  // Continuous flash during delay
void rfidLedDoorOpen();         // Solid ON while door is open
void rfidLedOff();              // Turn off RFID LED
void updateRfidLed();           // Non-blocking update (call in loop)

#endif // LED_CONTROLLER_H
