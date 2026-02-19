#ifndef WIFI_MANAGER_H
#define WIFI_MANAGER_H

#include <Arduino.h>

// ============================================
// WIFI & WEB SERVER
// ============================================

void setupWiFi();
void setupOTA();
void setupWebServer();
void checkWiFi();
void restartWebServices();

#endif // WIFI_MANAGER_H
