#include "WiFiManager.h"
#include "GlobalState.h"
#include "DoorController.h"
#include "BuzzerController.h"
#include "APIHandler.h"
#include <WiFi.h>
#include <ArduinoOTA.h>
#include <Update.h>

// ============================================
// WIFI & WEB SERVER
// ============================================

void setupWiFi() {
    DEBUG_PRINTLN("\n[WiFi] Connecting to WiFi...");
    DEBUG_PRINTF("[WiFi] SSID: %s\n", WIFI_SSID);
    
    // Configure static IP
    if (!WiFi.config(STATIC_IP_ADDR, GATEWAY_ADDR, SUBNET_MASK)) {
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
        DEBUG_PRINTLN("\n[WiFi] Connected!");
        DEBUG_PRINTF("[WiFi] IP Address: %s\n", WiFi.localIP().toString().c_str());
        
        // Sync NTP time
        configTime(NTP_GMT_OFFSET, NTP_DAYLIGHT_OFFSET, NTP_SERVER_1, NTP_SERVER_2);
        DEBUG_PRINTLN("[NTP] Time sync initiated (GMT+7 WIB)");
        
        // Wait briefly for NTP sync
        struct tm timeInfo;
        if (getLocalTime(&timeInfo, 3000)) {
            ntpSynced = true;
            DEBUG_PRINTF("[NTP] Time synced: %02d:%02d:%02d\n", timeInfo.tm_hour, timeInfo.tm_min, timeInfo.tm_sec);
        } else {
            DEBUG_PRINTLN("[NTP] Initial sync pending (will retry in background)");
        }
    } else {
        DEBUG_PRINTLN("\n[WiFi] Connection timeout - continuing offline");
        wifiConnected = false;
    }
}

void setupOTA() {
    if (!wifiConnected) return;
    
    DEBUG_PRINTLN("\n[OTA] Setting up OTA update...");
    
    // Hostname untuk identifikasi di network
    ArduinoOTA.setHostname("smart-door-lock");
    
    // Password protection
    ArduinoOTA.setPassword(OTA_PASSWORD);
    
    // Port (default 3232)
    ArduinoOTA.setPort(3232);
    
    // Callback saat OTA dimulai
    ArduinoOTA.onStart([]() {
        otaInProgress = true;
        String type;
        if (ArduinoOTA.getCommand() == U_FLASH) {
            type = "sketch";
        } else { // U_SPIFFS
            type = "filesystem";
        }
        
        DEBUG_PRINTLN("\n[OTA] Update started: " + type);
        lastEvent = "OTA update started";
        
        // Lock door saat OTA dimulai untuk keamanan
        lockDoor();
        
        // LED blink cepat selama OTA
        digitalWrite(LED_PIN, HIGH);
        
        // Buzzer indication
        playBuzzerPattern(PATTERN_ENTER_REG_MODE);
    });
    
    // Callback saat progress OTA
    ArduinoOTA.onProgress([](unsigned int progress, unsigned int total) {
        unsigned int percent = (progress / (total / 100));
        DEBUG_PRINTF("[OTA] Progress: %u%%\r", percent);
        
        // LED blink progress indication
        if (percent % 10 == 0) {
            digitalWrite(LED_PIN, !digitalRead(LED_PIN));
        }
    });
    
    // Callback saat OTA selesai
    ArduinoOTA.onEnd([]() {
        DEBUG_PRINTLN("\n[OTA] Update completed!");
        digitalWrite(LED_PIN, HIGH);
        playBuzzerPattern(PATTERN_INIT_OK);
        delay(500);
    });
    
    // Callback saat OTA error
    ArduinoOTA.onError([](ota_error_t error) {
        otaInProgress = false;
        DEBUG_PRINTF("[OTA] Error[%u]: ", error);
        
        if (error == OTA_AUTH_ERROR) {
            DEBUG_PRINTLN("Auth Failed");
            lastEvent = "OTA: Auth failed";
        } else if (error == OTA_BEGIN_ERROR) {
            DEBUG_PRINTLN("Begin Failed");
            lastEvent = "OTA: Begin failed";
        } else if (error == OTA_CONNECT_ERROR) {
            DEBUG_PRINTLN("Connect Failed");
            lastEvent = "OTA: Connect failed";
        } else if (error == OTA_RECEIVE_ERROR) {
            DEBUG_PRINTLN("Receive Failed");
            lastEvent = "OTA: Receive failed";
        } else if (error == OTA_END_ERROR) {
            DEBUG_PRINTLN("End Failed");
            lastEvent = "OTA: End failed";
        }
        
        playBuzzerPattern(PATTERN_INVALID_CARD);
    });
    
    ArduinoOTA.begin();
    
    DEBUG_PRINTLN("[OTA] OTA update enabled");
    DEBUG_PRINTF("[OTA] Hostname: smart-door-lock\n");
    DEBUG_PRINTF("[OTA] Password: %s\n", OTA_PASSWORD);
    DEBUG_PRINTLN("[OTA] Use Arduino IDE or PlatformIO for OTA upload");
}

void setupWebServer() {
    if (!wifiConnected) return;
    
    DEBUG_PRINTLN("[WEB] Setting up web server...");
    
    // Root page - plain text health check
    server.on("/", HTTP_GET, [](AsyncWebServerRequest *request) {
        request->send(200, "text/plain", "hi, esp baik baik aja :)");
    });
    
    // OTA Update - CORS preflight handler
    server.on("/do-update", HTTP_OPTIONS, [](AsyncWebServerRequest *request) {
        AsyncWebServerResponse *response = request->beginResponse(200);
        addCorsHeaders(response);
        request->send(response);
    });
    
    // OTA Update Handler
    server.on("/do-update", HTTP_POST, [](AsyncWebServerRequest *request) {
        // Response after update completes
        bool hasError = Update.hasError();
        AsyncWebServerResponse *response = request->beginResponse(200, "application/json", 
            hasError ? "{\"success\":false,\"message\":\"Update failed\"}" : "{\"success\":true,\"message\":\"Update successful, restarting...\"}");
        response->addHeader("Connection", "close");
        addCorsHeaders(response);
        request->send(response);
        
        if (!hasError) {
            // Restart ESP32
            delay(1000);
            ESP.restart();
        }
        
    }, [](AsyncWebServerRequest *request, String filename, size_t index, uint8_t *data, size_t len, bool final) {
        // Handle file upload
        if (!index) {
            DEBUG_PRINTLN("\n[WEB OTA] Update started");
            DEBUG_PRINTF("[WEB OTA] File: %s\n", filename.c_str());
            
            // Lock door for safety
            lockDoor();
            otaInProgress = true;
            lastEvent = "Web OTA update started";
            
            // Start update
            if (!Update.begin(UPDATE_SIZE_UNKNOWN)) {
                Update.printError(Serial);
                DEBUG_PRINTLN("[WEB OTA] Update begin failed");
            }
        }
        
        // Write firmware data
        if (Update.write(data, len) != len) {
            Update.printError(Serial);
        }
        
        // Show progress
        if (index % 10240 == 0) {
            DEBUG_PRINTF("[WEB OTA] Progress: %d bytes\r", index + len);
        }
        
        // Final chunk
        if (final) {
            if (Update.end(true)) {
                DEBUG_PRINTF("\n[WEB OTA] Update success: %u bytes\n", index + len);
                lastEvent = "Web OTA update completed";
            } else {
                Update.printError(Serial);
                DEBUG_PRINTLN("[WEB OTA] Update failed");
                otaInProgress = false;
                lastEvent = "Web OTA update failed";
            }
        }
    });
    
    // Setup API endpoints for web interface
    setupAPIEndpoints(server);
    
    // Setup WebSocket for real-time updates
    setupWebSocket(server);
    
    server.begin();
    DEBUG_PRINTLN("[WEB] Web server started");
    DEBUG_PRINTLN("[API] REST API endpoints ready");
    DEBUG_PRINTLN("[WebSocket] WebSocket ready on port 80");
    DEBUG_PRINTLN("[INFO] Use external Next.js web dashboard for monitoring & control");
}
