#include "WiFiManager.h"
#include "GlobalState.h"
#include "DoorController.h"
#include "BuzzerController.h"
#include "config.h"
#include <WiFi.h>

// ============================================
// WIFI MANAGER (MQTT Mode — no web server)
// ============================================

// WiFi reconnect tracking
static unsigned long lastWiFiReconnectAttempt = 0;
static bool wifiWasConnected = false;

void setupWiFi() {
    DEBUG_PRINTLN("\n[WiFi] Connecting to WiFi...");
    DEBUG_PRINTF("[WiFi] SSID: %s\n", WIFI_SSID);
    
    // Set WiFi mode and enable auto-reconnect
    WiFi.mode(WIFI_STA);
    WiFi.setAutoReconnect(true);
    WiFi.persistent(true);
    
    // Register WiFi event handlers for robust reconnection
    WiFi.onEvent([](WiFiEvent_t event, WiFiEventInfo_t info) {
        DEBUG_PRINTLN("[WiFi] EVENT: Disconnected from AP");
        wifiConnected = false;
        lastEvent = "WiFi disconnected";
    }, WiFiEvent_t::ARDUINO_EVENT_WIFI_STA_DISCONNECTED);
    
    WiFi.onEvent([](WiFiEvent_t event, WiFiEventInfo_t info) {
        wifiConnected = true;
        wifiWasConnected = true;
        DEBUG_PRINTF("[WiFi] EVENT: Got IP - %s\n", WiFi.localIP().toString().c_str());
        lastEvent = "WiFi reconnected";
    }, WiFiEvent_t::ARDUINO_EVENT_WIFI_STA_GOT_IP);
    
    // Configure static IP with DNS (gateway doubles as DNS, + Google DNS fallback)
    if (!WiFi.config(STATIC_IP_ADDR, GATEWAY_ADDR, SUBNET_MASK, GATEWAY_ADDR, IPAddress(8, 8, 8, 8))) {
        DEBUG_PRINTLN("[WiFi] WARNING: Failed to configure static IP");
    }
    
    WiFi.begin(WIFI_SSID, WIFI_PASSWORD);
    
    unsigned long startAttempt = millis();
    // Non-blocking WiFi connection dengan yield()
    while (WiFi.status() != WL_CONNECTED && millis() - startAttempt < WIFI_CONNECT_TIMEOUT) {
        yield();  // Biarkan ESP32 handle background tasks
        delay(100);  // Delay kecil, non-blocking
        
        // Print progress tiap 500ms
        static unsigned long lastPrint = 0;
        if (millis() - lastPrint > 500) {
            DEBUG_PRINT(".");
            lastPrint = millis();
        }
    }
    
    if (WiFi.status() == WL_CONNECTED) {
        wifiConnected = true;
        wifiWasConnected = true;
        DEBUG_PRINTLN("\n[WiFi] Connected!");
        DEBUG_PRINTF("[WiFi] IP Address: %s\n", WiFi.localIP().toString().c_str());
        
        // Sync NTP time — use POSIX timezone (more reliable than gmtOffset)
        configTzTime(NTP_TIMEZONE, NTP_SERVER_1, NTP_SERVER_2);
        DEBUG_PRINTLN("[NTP] Time sync initiated (POSIX TZ: " NTP_TIMEZONE ")");
        DEBUG_PRINTF("[NTP] Servers: %s, %s\n", NTP_SERVER_1, NTP_SERVER_2);
        
        // Wait for NTP sync (up to 5s)
        struct tm timeInfo;
        if (getLocalTime(&timeInfo, 5000)) {
            ntpSynced = true;
            DEBUG_PRINTF("[NTP] Time synced: %02d:%02d:%02d\n", timeInfo.tm_hour, timeInfo.tm_min, timeInfo.tm_sec);
        } else {
            DEBUG_PRINTLN("[NTP] Initial sync pending (SNTP will retry in background)");
        }
    } else {
        DEBUG_PRINTLN("\n[WiFi] Connection timeout - continuing offline");
        wifiConnected = false;
    }
}

// OTA is now handled via MQTT — see OTAUpdate.cpp
void setupOTA() {
    // Intentionally empty — OTA via MQTT, not ArduinoOTA
    DEBUG_PRINTLN("[OTA] OTA updates via MQTT (no ArduinoOTA)");
}

// Web server removed — all communication via MQTT
void setupWebServer() {
    // Intentionally empty — no HTTP server in MQTT mode
    DEBUG_PRINTLN("[WEB] No web server — using MQTT for all communication");
}

// ============================================
// WIFI RECONNECT
// ============================================

void restartWebServices() {
    // Re-sync NTP after reconnect
    configTzTime(NTP_TIMEZONE, NTP_SERVER_1, NTP_SERVER_2);
    DEBUG_PRINTLN("[NTP] Time re-sync initiated after WiFi reconnect");
}

void checkWiFi() {
    unsigned long now = millis();
    
    // If WiFi is connected, nothing else to do
    if (WiFi.status() == WL_CONNECTED) {
        return;
    }
    
    // WiFi is disconnected — attempt periodic reconnect
    wifiConnected = false;
    
    if (now - lastWiFiReconnectAttempt >= WIFI_RECONNECT_INTERVAL) {
        lastWiFiReconnectAttempt = now;
        
        DEBUG_PRINTLN("[WiFi] Connection lost, attempting reconnect...");
        
        // Re-apply static IP config with DNS before reconnecting
        if (!WiFi.config(STATIC_IP_ADDR, GATEWAY_ADDR, SUBNET_MASK, GATEWAY_ADDR, IPAddress(8, 8, 8, 8))) {
            DEBUG_PRINTLN("[WiFi] WARNING: Failed to reconfigure static IP");
        }
        
        WiFi.disconnect(false);  // Disconnect without erasing config
        delay(100);
        WiFi.begin(WIFI_SSID, WIFI_PASSWORD);
        
        DEBUG_PRINTLN("[WiFi] Reconnect initiated, waiting for event callback...");
    }
}
