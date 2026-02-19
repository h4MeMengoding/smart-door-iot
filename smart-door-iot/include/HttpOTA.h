#ifndef HTTP_OTA_H
#define HTTP_OTA_H

#include <Arduino.h>

// ============================================
// HTTP OTA — Fallback firmware upload via browser
// ============================================
// Serves a simple upload page at http://<ESP32-IP>/ota
// Password protected. Only /ota is accessible.

void setupHttpOTA();
void handleHttpOTA();  // Call in loop()

#endif // HTTP_OTA_H
