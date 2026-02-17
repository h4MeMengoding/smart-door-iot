#include "APIHandler.h"
#include "GlobalState.h"
#include "DoorController.h"
#include "CardManager.h"
#include "BuzzerController.h"
#include "LEDController.h"
#include "config.h"
#include <WiFi.h>
#include <ArduinoJson.h>
#include <esp_ota_ops.h>
#include <sys/time.h>

// WebSocket instance
AsyncWebSocket ws("/ws");

// ============================================
// AUTHENTICATION MIDDLEWARE
// ============================================

bool validateApiKey(AsyncWebServerRequest* request) {
    #if ENABLE_API_AUTH
        if (!request->hasHeader(API_KEY_HEADER)) {
            DEBUG_PRINTLN("[API Auth] Missing API key header");
            return false;
        }
        
        String receivedKey = request->header(API_KEY_HEADER);
        String validKey = String(API_KEY);
        
        if (receivedKey != validKey) {
            DEBUG_PRINTLN("[API Auth] Invalid API key");
            return false;
        }
        
        return true;
    #else
        return true;  // Auth disabled
    #endif
}

// ============================================
// CORS HEADERS
// ============================================

void addCorsHeaders(AsyncWebServerResponse* response) {
    response->addHeader("Access-Control-Allow-Origin", "*");
    response->addHeader("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS");
    response->addHeader("Access-Control-Allow-Headers", "Content-Type, X-API-Key, Authorization");
}

// ============================================
// CONFIG NVS HELPERS
// ============================================

void saveAutoLockToNVS(uint16_t seconds) {
    nvs.putUShort(NVS_AUTOLOCK_KEY, seconds);
    DEBUG_PRINTF("[Config] Auto-lock saved to NVS: %us\n", seconds);
}

void saveCardDelayToNVS(const String& uidHex, uint16_t seconds) {
    // Key format: "d" + uid hex (max 15 chars)
    String key = "d" + uidHex;
    key.toUpperCase();
    if (key.length() > 15) key = key.substring(0, 15);
    nvs.putUShort(key.c_str(), seconds);
    DEBUG_PRINTF("[Config] Card delay saved to NVS: %s = %us\n", key.c_str(), seconds);
}

void saveCardScheduleToNVS(const String& uidHex, uint8_t startHour, uint8_t endHour, uint8_t delaySec) {
    String key = "s" + uidHex;
    key.toUpperCase();
    if (key.length() > 15) key = key.substring(0, 15);
    uint8_t data[3] = {startHour, endHour, delaySec};
    nvs.putBytes(key.c_str(), data, 3);
    DEBUG_PRINTF("[Config] Card schedule saved to NVS: %s = %02d:00-%02d:00 %us\n", key.c_str(), startHour, endHour, delaySec);
}

void removeCardScheduleFromNVS(const String& uidHex) {
    String key = "s" + uidHex;
    key.toUpperCase();
    if (key.length() > 15) key = key.substring(0, 15);
    nvs.remove(key.c_str());
    DEBUG_PRINTF("[Config] Card schedule removed from NVS: %s\n", key.c_str());
}

// ============================================
// HELPER: State to string
// ============================================

static String stateToString(SystemState state) {
    switch (state) {
        case STATE_IDLE: return "IDLE";
        case STATE_AUTH_CHECK: return "AUTH_CHECK";
        case STATE_PRE_UNLOCK: return "PRE_UNLOCK";
        case STATE_UNLOCK: return "UNLOCK";
        case STATE_REGISTRATION_MODE: return "REGISTRATION_MODE";
        case STATE_CLONE_MODE: return "CLONE_MODE";
        case STATE_ERROR: return "ERROR";
        default: return "UNKNOWN";
    }
}

// ============================================
// API ENDPOINTS
// ============================================

void setupAPIEndpoints(AsyncWebServer& server) {
    
    // OPTIONS handler for CORS preflight
    server.on("/api/*", HTTP_OPTIONS, [](AsyncWebServerRequest *request) {
        AsyncWebServerResponse *response = request->beginResponse(204);
        addCorsHeaders(response);
        request->send(response);
    });
    
    // GET /api/status - Door status (existing endpoint with CORS)
    server.on("/api/status", HTTP_GET, [](AsyncWebServerRequest *request) {
        // Authentication check
        if (!validateApiKey(request)) {
            AsyncWebServerResponse *response = request->beginResponse(401, "application/json", 
                "{\"success\":false,\"message\":\"Unauthorized - Invalid or missing API key\"}");
            addCorsHeaders(response);
            request->send(response);
            return;
        }
        
        String stateStr = stateToString(currentState);
        
        unsigned long uptime = (millis() - systemStartTime) / 1000;
        
        DynamicJsonDocument doc(1024);
        doc["doorUnlocked"] = doorUnlocked;
        doc["doorStatus"] = doorUnlocked ? "UNLOCKED" : "LOCKED";
        doc["state"] = stateStr;
        doc["lastCard"] = lastCardUID;
        doc["lastEvent"] = lastEvent;
        doc["cardCount"] = userCardCount;
        doc["uptime"] = String(uptime) + "s";
        doc["autoLockDuration"] = configuredAutoLockMs / 1000;
        doc["rfidDisabled"] = rfidDisabled;
        doc["rfidAutoEnableMs"] = (rfidDisabled && rfidAutoEnableTime > 0 && rfidAutoEnableTime > millis()) ? (rfidAutoEnableTime - millis()) : 0;
        doc["ntpSynced"] = ntpSynced;
        doc["currentHour"] = getCurrentHour();

        // Full time string for dashboard
        struct tm statusTimeInfo;
        if (getLocalTime(&statusTimeInfo, 50)) {
            char timeBuf[20];
            snprintf(timeBuf, sizeof(timeBuf), "%02d:%02d:%02d", statusTimeInfo.tm_hour, statusTimeInfo.tm_min, statusTimeInfo.tm_sec);
            doc["currentTime"] = timeBuf;
        }
        
        String json;
        serializeJson(doc, json);
        
        AsyncWebServerResponse *response = request->beginResponse(200, "application/json", json);
        addCorsHeaders(response);
        request->send(response);
    });
    
    // POST /api/door/unlock - Unlock door
    server.on("/api/door/unlock", HTTP_POST, [](AsyncWebServerRequest *request) {
        // Authentication check
        if (!validateApiKey(request)) {
            AsyncWebServerResponse *response = request->beginResponse(401, "application/json", 
                "{\"success\":false,\"message\":\"Unauthorized - Invalid or missing API key\"}");
            addCorsHeaders(response);
            request->send(response);
            return;
        }
        
        DEBUG_PRINTLN("[API] Unlock door requested");
        
        unlockDoor();
        rfidLedDoorOpen();  // RFID LED: solid ON while door open
        currentState = STATE_UNLOCK;
        stateStartTime = millis();
        lastEvent = "Door unlocked via API";
        
        DynamicJsonDocument doc(256);
        doc["success"] = true;
        doc["message"] = "Door unlocked successfully";
        
        String json;
        serializeJson(doc, json);
        
        AsyncWebServerResponse *response = request->beginResponse(200, "application/json", json);
        addCorsHeaders(response);
        request->send(response);
        
        // Broadcast to WebSocket clients
        broadcastDoorStatus();
    });
    
    // POST /api/door/lock - Lock door
    server.on("/api/door/lock", HTTP_POST, [](AsyncWebServerRequest *request) {
        // Authentication check
        if (!validateApiKey(request)) {
            AsyncWebServerResponse *response = request->beginResponse(401, "application/json", 
                "{\"success\":false,\"message\":\"Unauthorized - Invalid or missing API key\"}");
            addCorsHeaders(response);
            request->send(response);
            return;
        }
        
        DEBUG_PRINTLN("[API] Lock door requested");
        
        rfidLedOff();  // Turn off RFID LED when door locks
        lockDoor();
        lastEvent = "Door locked via API";
        
        DynamicJsonDocument doc(256);
        doc["success"] = true;
        doc["message"] = "Door locked successfully";
        
        String json;
        serializeJson(doc, json);
        
        AsyncWebServerResponse *response = request->beginResponse(200, "application/json", json);
        addCorsHeaders(response);
        request->send(response);
        
        // Broadcast to WebSocket clients
        broadcastDoorStatus();
    });
    
    // POST /api/mode/register - Toggle registration mode (same as master card tap)
    server.on("/api/mode/register", HTTP_POST, [](AsyncWebServerRequest *request) {
        // Authentication check
        if (!validateApiKey(request)) {
            AsyncWebServerResponse *response = request->beginResponse(401, "application/json", 
                "{\"success\":false,\"message\":\"Unauthorized - Invalid or missing API key\"}");
            addCorsHeaders(response);
            request->send(response);
            return;
        }
        
        DynamicJsonDocument doc(256);
        
        if (currentState == STATE_REGISTRATION_MODE) {
            // Already in registration mode — exit
            DEBUG_PRINTLN("[API] Exiting registration mode via API");
            playBuzzerPattern(PATTERN_EXIT_REG_MODE);
            currentState = STATE_IDLE;
            lastEvent = "Registration mode exited (web)";
            
            doc["success"] = true;
            doc["message"] = "Exited registration mode";
            doc["registrationMode"] = false;
        } else {
            // Enter registration mode
            DEBUG_PRINTLN("[API] Entering registration mode via API");
            playBuzzerPattern(PATTERN_ENTER_REG_MODE);
            currentState = STATE_REGISTRATION_MODE;
            stateStartTime = millis();
            lastActivityTime = millis();
            lastEvent = "Registration mode (web)";
            
            doc["success"] = true;
            doc["message"] = "Entered registration mode";
            doc["registrationMode"] = true;
        }
        
        String json;
        serializeJson(doc, json);
        
        AsyncWebServerResponse *response = request->beginResponse(200, "application/json", json);
        addCorsHeaders(response);
        request->send(response);
        
        // Broadcast to WebSocket clients
        broadcastDoorStatus();
    });
    
    // GET /api/cards - Get all registered cards
    server.on("/api/cards", HTTP_GET, [](AsyncWebServerRequest *request) {
        // Authentication check
        if (!validateApiKey(request)) {
            AsyncWebServerResponse *response = request->beginResponse(401, "application/json", 
                "{\"success\":false,\"message\":\"Unauthorized - Invalid or missing API key\"}");
            addCorsHeaders(response);
            request->send(response);
            return;
        }
        
        DynamicJsonDocument doc(2048);
        JsonArray cards = doc.to<JsonArray>();
        
        // Use in-memory card array (avoids NVS size-prefix bug)
        for (uint8_t i = 0; i < userCardCount; i++) {
            JsonObject card = cards.createNestedObject();
            card["uid"] = uidToString(userCards[i].uid, userCards[i].size);
        }
        
        String json;
        serializeJson(doc, json);
        
        AsyncWebServerResponse *response = request->beginResponse(200, "application/json", json);
        addCorsHeaders(response);
        request->send(response);
    });
    
    // POST /api/cards/sync - Sync cards from server (DB is source of truth)
    // NOTE: Must be registered BEFORE /api/cards POST to avoid prefix-match collision
    server.on("/api/cards/sync", HTTP_POST, [](AsyncWebServerRequest *request) {}, NULL,
        [](AsyncWebServerRequest *request, uint8_t *data, size_t len, size_t index, size_t total) {
            if (!validateApiKey(request)) {
                AsyncWebServerResponse *response = request->beginResponse(401, "application/json", 
                    "{\"success\":false,\"message\":\"Unauthorized\"}");
                addCorsHeaders(response);
                request->send(response);
                return;
            }
            
            DynamicJsonDocument doc(4096);
            DeserializationError error = deserializeJson(doc, (const char*)data, len);
            
            if (error || !doc.containsKey("uids")) {
                DEBUG_PRINTF("[API] Sync parse error: %s, len=%u\n", error.c_str(), len);
                AsyncWebServerResponse *response = request->beginResponse(400, "application/json", 
                    "{\"success\":false,\"message\":\"Missing uids array\"}");
                addCorsHeaders(response);
                request->send(response);
                return;
            }
            
            JsonArray uidList = doc["uids"].as<JsonArray>();
            syncCardsFromList(uidList);
            
            DynamicJsonDocument responseDoc(256);
            responseDoc["success"] = true;
            responseDoc["message"] = "Cards synced";
            responseDoc["count"] = userCardCount;
            
            String json;
            serializeJson(responseDoc, json);
            
            AsyncWebServerResponse *response = request->beginResponse(200, "application/json", json);
            addCorsHeaders(response);
            request->send(response);
            
            DEBUG_PRINTF("[API] Cards synced: %d cards\n", userCardCount);
            // Broadcast updated status
            broadcastDoorStatus();
        }
    );

    // POST /api/cards/remove - Remove card (body-based, no regex needed)
    server.on("/api/cards/remove", HTTP_POST, [](AsyncWebServerRequest *request) {}, NULL,
        [](AsyncWebServerRequest *request, uint8_t *data, size_t len, size_t index, size_t total) {
            if (!validateApiKey(request)) {
                AsyncWebServerResponse *response = request->beginResponse(401, "application/json", 
                    "{\"success\":false,\"message\":\"Unauthorized\"}");
                addCorsHeaders(response);
                request->send(response);
                return;
            }
            
            DynamicJsonDocument doc(256);
            DeserializationError error = deserializeJson(doc, (const char*)data, len);
            
            if (error || !doc.containsKey("uid")) {
                AsyncWebServerResponse *response = request->beginResponse(400, "application/json", 
                    "{\"success\":false,\"message\":\"Missing uid\"}");
                addCorsHeaders(response);
                request->send(response);
                return;
            }
            
            String uidStr = doc["uid"].as<String>();
            uidStr.toUpperCase();
            uidStr.replace(":", "");
            
            byte uid[7];
            uint8_t uidSize = 0;
            for (size_t i = 0; i < uidStr.length() && i < 14; i += 2) {
                String byteStr = uidStr.substring(i, i + 2);
                uid[uidSize++] = (byte)strtol(byteStr.c_str(), NULL, 16);
            }
            
            if (uidSize == 0) {
                AsyncWebServerResponse *response = request->beginResponse(400, "application/json", 
                    "{\"success\":false,\"message\":\"Invalid UID\"}");
                addCorsHeaders(response);
                request->send(response);
                return;
            }
            
            if (removeCardFromNVS(uid, uidSize)) {
                DynamicJsonDocument respDoc(128);
                respDoc["success"] = true;
                respDoc["count"] = userCardCount;
                
                String json;
                serializeJson(respDoc, json);
                
                AsyncWebServerResponse *response = request->beginResponse(200, "application/json", json);
                addCorsHeaders(response);
                request->send(response);
                
                playBuzzerPattern(PATTERN_REMOVE_SUCCESS);
                broadcastDoorStatus();
            } else {
                AsyncWebServerResponse *response = request->beginResponse(404, "application/json", 
                    "{\"success\":false,\"message\":\"Card not found\"}");
                addCorsHeaders(response);
                request->send(response);
            }
        }
    );

    // POST /api/cards - Add new card
    server.on("/api/cards", HTTP_POST, [](AsyncWebServerRequest *request) {}, NULL,
        [](AsyncWebServerRequest *request, uint8_t *data, size_t len, size_t index, size_t total) {
            // Authentication check
            if (!validateApiKey(request)) {
                AsyncWebServerResponse *response = request->beginResponse(401, "application/json", 
                    "{\"success\":false,\"message\":\"Unauthorized - Invalid or missing API key\"}");
                addCorsHeaders(response);
                request->send(response);
                return;
            }
            
            DynamicJsonDocument doc(256);
            DeserializationError error = deserializeJson(doc, (const char*)data, len);
            
            if (error) {
                AsyncWebServerResponse *response = request->beginResponse(400, "application/json", 
                    "{\"success\":false,\"message\":\"Invalid JSON\"}");
                addCorsHeaders(response);
                request->send(response);
                return;
            }
            
            String uidStr = doc["uid"].as<String>();
            uidStr.toUpperCase();
            uidStr.replace(":", "");
            
            // Convert hex string to byte array
            byte uid[7];
            uint8_t uidSize = 0;
            
            for (size_t i = 0; i < uidStr.length() && i < 14; i += 2) {
                String byteStr = uidStr.substring(i, i + 2);
                uid[uidSize++] = (byte)strtol(byteStr.c_str(), NULL, 16);
            }
            
            if (uidSize == 0) {
                AsyncWebServerResponse *response = request->beginResponse(400, "application/json", 
                    "{\"success\":false,\"message\":\"Invalid UID format\"}");
                addCorsHeaders(response);
                request->send(response);
                return;
            }
            
            // Check if card already exists
            if (isCardRegistered(uid, uidSize) || isMasterCard(uid, uidSize)) {
                AsyncWebServerResponse *response = request->beginResponse(400, "application/json", 
                    "{\"success\":false,\"message\":\"Card already registered\"}");
                addCorsHeaders(response);
                request->send(response);
                return;
            }
            
            // Add card
            if (addCardToNVS(uid, uidSize)) {
                DynamicJsonDocument responseDoc(256);
                responseDoc["success"] = true;
                responseDoc["message"] = "Card added successfully";
                responseDoc["count"] = userCardCount;
                
                String json;
                serializeJson(responseDoc, json);
                
                AsyncWebServerResponse *response = request->beginResponse(200, "application/json", json);
                addCorsHeaders(response);
                request->send(response);
                
                DEBUG_PRINTF("[API] Card added: %s\n", uidStr.c_str());
                playBuzzerPattern(PATTERN_ADD_SUCCESS);
            } else {
                AsyncWebServerResponse *response = request->beginResponse(500, "application/json", 
                    "{\"success\":false,\"message\":\"Failed to add card (storage full or error)\"}");
                addCorsHeaders(response);
                request->send(response);
            }
        }
    );
    
    // GET /api/system/info - System information
    server.on("/api/system/info", HTTP_GET, [](AsyncWebServerRequest *request) {
        // Authentication check
        if (!validateApiKey(request)) {
            AsyncWebServerResponse *response = request->beginResponse(401, "application/json", 
                "{\"success\":false,\"message\":\"Unauthorized - Invalid or missing API key\"}");
            addCorsHeaders(response);
            request->send(response);
            return;
        }
        
        unsigned long uptime = (millis() - systemStartTime) / 1000;
        
        // Memory info
        uint32_t freeHeap = ESP.getFreeHeap();
        uint32_t totalHeap = ESP.getHeapSize();
        uint32_t usedFlash = ESP.getSketchSize();
        uint32_t totalFlash = ESP.getFlashChipSize();
        
        // Partition size (what PIO uses for flash %)
        const esp_partition_t* running = esp_ota_get_running_partition();
        uint32_t partitionSize = running ? running->size : totalFlash;
        
        // Temperature (internal sensor)
        float tempC = temperatureRead();
        
        DynamicJsonDocument doc(1024);
        doc["ip"] = WiFi.localIP().toString();
        doc["rssi"] = WiFi.RSSI();
        doc["uptime"] = String(uptime) + "s";
        doc["firmwareVersion"] = "1.0.0";
        doc["freeHeap"] = freeHeap;
        doc["totalHeap"] = totalHeap;
        doc["usedFlash"] = usedFlash;
        doc["totalFlash"] = totalFlash;
        doc["partitionSize"] = partitionSize;
        doc["temperature"] = tempC;
        
        String json;
        serializeJson(doc, json);
        
        AsyncWebServerResponse *response = request->beginResponse(200, "application/json", json);
        addCorsHeaders(response);
        request->send(response);
    });

    // ============================================
    // TIME / NTP ENDPOINTS
    // ============================================

    // GET /api/time - Get ESP32 current time
    server.on("/api/time", HTTP_GET, [](AsyncWebServerRequest *request) {
        if (!validateApiKey(request)) {
            AsyncWebServerResponse *response = request->beginResponse(401, "application/json", 
                "{\"success\":false,\"message\":\"Unauthorized\"}");
            addCorsHeaders(response);
            request->send(response);
            return;
        }

        DynamicJsonDocument doc(512);
        doc["ntpSynced"] = ntpSynced;

        struct tm timeInfo;
        if (getLocalTime(&timeInfo, 100)) {
            doc["hour"] = timeInfo.tm_hour;
            doc["minute"] = timeInfo.tm_min;
            doc["second"] = timeInfo.tm_sec;
            doc["day"] = timeInfo.tm_mday;
            doc["month"] = timeInfo.tm_mon + 1;
            doc["year"] = timeInfo.tm_year + 1900;

            char timeStr[20];
            snprintf(timeStr, sizeof(timeStr), "%02d:%02d:%02d", timeInfo.tm_hour, timeInfo.tm_min, timeInfo.tm_sec);
            doc["time"] = timeStr;

            char dateStr[11];
            snprintf(dateStr, sizeof(dateStr), "%04d-%02d-%02d", timeInfo.tm_year + 1900, timeInfo.tm_mon + 1, timeInfo.tm_mday);
            doc["date"] = dateStr;

            // Unix timestamp
            doc["epoch"] = (unsigned long)mktime(&timeInfo);
        } else {
            doc["hour"] = -1;
            doc["minute"] = -1;
            doc["second"] = -1;
            doc["time"] = "not synced";
            doc["date"] = "not synced";
            doc["epoch"] = 0;
        }

        String json;
        serializeJson(doc, json);
        AsyncWebServerResponse *response = request->beginResponse(200, "application/json", json);
        addCorsHeaders(response);
        request->send(response);
    });

    // POST /api/time/sync - Force NTP re-sync
    server.on("/api/time/sync", HTTP_POST, [](AsyncWebServerRequest *request) {
        if (!validateApiKey(request)) {
            AsyncWebServerResponse *response = request->beginResponse(401, "application/json", 
                "{\"success\":false,\"message\":\"Unauthorized\"}");
            addCorsHeaders(response);
            request->send(response);
            return;
        }

        DEBUG_PRINTLN("[NTP] Forced re-sync requested via API");
        configTzTime(NTP_TIMEZONE, NTP_SERVER_1, NTP_SERVER_2);

        // Wait for sync (up to 5s)
        struct tm timeInfo;
        bool synced = getLocalTime(&timeInfo, 5000);
        if (synced) {
            ntpSynced = true;
        }

        DynamicJsonDocument doc(256);
        doc["success"] = synced;
        doc["ntpSynced"] = ntpSynced;
        if (synced) {
            char timeStr[20];
            snprintf(timeStr, sizeof(timeStr), "%02d:%02d:%02d", timeInfo.tm_hour, timeInfo.tm_min, timeInfo.tm_sec);
            doc["time"] = timeStr;
            doc["hour"] = timeInfo.tm_hour;
            doc["message"] = "NTP re-synced successfully";
        } else {
            doc["message"] = "NTP sync failed — will retry in background";
        }

        String json;
        serializeJson(doc, json);
        AsyncWebServerResponse *response = request->beginResponse(200, "application/json", json);
        addCorsHeaders(response);
        request->send(response);
    });

    // POST /api/time/set - Set time from browser (fallback when NTP fails)
    server.on("/api/time/set", HTTP_POST, [](AsyncWebServerRequest *request) {}, NULL,
        [](AsyncWebServerRequest *request, uint8_t *data, size_t len, size_t index, size_t total) {
            if (!validateApiKey(request)) {
                AsyncWebServerResponse *response = request->beginResponse(401, "application/json", 
                    "{\"success\":false,\"message\":\"Unauthorized\"}");
                addCorsHeaders(response);
                request->send(response);
                return;
            }

            DynamicJsonDocument doc(256);
            DeserializationError error = deserializeJson(doc, (const char*)data, len);
            if (error || !doc.containsKey("epoch")) {
                AsyncWebServerResponse *response = request->beginResponse(400, "application/json", 
                    "{\"success\":false,\"message\":\"epoch required\"}");
                addCorsHeaders(response);
                request->send(response);
                return;
            }

            unsigned long epoch = doc["epoch"] | 0UL;
            if (epoch < 1000000000UL) {
                AsyncWebServerResponse *response = request->beginResponse(400, "application/json", 
                    "{\"success\":false,\"message\":\"Invalid epoch\"}");
                addCorsHeaders(response);
                request->send(response);
                return;
            }

            // Set system time from browser epoch (UTC)
            struct timeval tv;
            tv.tv_sec = (time_t)epoch;
            tv.tv_usec = 0;
            settimeofday(&tv, NULL);

            // Ensure timezone is set
            setenv("TZ", NTP_TIMEZONE, 1);
            tzset();

            ntpSynced = true;
            DEBUG_PRINTF("[TIME] Time set from browser: epoch=%lu\n", epoch);

            struct tm timeInfo;
            getLocalTime(&timeInfo, 100);

            DynamicJsonDocument resp(256);
            resp["success"] = true;
            resp["message"] = "Time set from browser";
            char timeStr[20];
            snprintf(timeStr, sizeof(timeStr), "%02d:%02d:%02d", timeInfo.tm_hour, timeInfo.tm_min, timeInfo.tm_sec);
            resp["time"] = timeStr;
            resp["hour"] = timeInfo.tm_hour;

            String json;
            serializeJson(resp, json);
            AsyncWebServerResponse *response = request->beginResponse(200, "application/json", json);
            addCorsHeaders(response);
            request->send(response);
        });
    
    // POST /api/system/restart - Restart ESP32
    server.on("/api/system/restart", HTTP_POST, [](AsyncWebServerRequest *request) {
        // Authentication check
        if (!validateApiKey(request)) {
            AsyncWebServerResponse *response = request->beginResponse(401, "application/json", 
                "{\"success\":false,\"message\":\"Unauthorized - Invalid or missing API key\"}");
            addCorsHeaders(response);
            request->send(response);
            return;
        }
        
        AsyncWebServerResponse *response = request->beginResponse(200, "application/json", 
            "{\"success\":true,\"message\":\"Restarting ESP32...\"}");
        addCorsHeaders(response);
        request->send(response);
        
        DEBUG_PRINTLN("[API] Restart requested");
        delay(1000);
        ESP.restart();
    });
    
    // POST /api/buzzer/play - Test buzzer
    server.on("/api/buzzer/play", HTTP_POST, [](AsyncWebServerRequest *request) {}, NULL,
        [](AsyncWebServerRequest *request, uint8_t *data, size_t len, size_t index, size_t total) {
            // Authentication check
            if (!validateApiKey(request)) {
                AsyncWebServerResponse *response = request->beginResponse(401, "application/json", 
                    "{\"success\":false,\"message\":\"Unauthorized - Invalid or missing API key\"}");
                addCorsHeaders(response);
                request->send(response);
                return;
            }
            
            DynamicJsonDocument doc(256);
            DeserializationError error = deserializeJson(doc, (const char*)data, len);
            
            if (!error && doc.containsKey("pattern")) {
                String pattern = doc["pattern"].as<String>();
                
                if (pattern == "VALID_CARD") {
                    playBuzzerPattern(PATTERN_VALID_CARD);
                } else if (pattern == "INVALID_CARD") {
                    playBuzzerPattern(PATTERN_INVALID_CARD);
                } else if (pattern == "UNLOCKED") {
                    playBuzzerPattern(PATTERN_VALID_CARD);
                } else {
                    playBuzzerPattern(PATTERN_VALID_CARD); // Default
                }
            }
            
            AsyncWebServerResponse *response = request->beginResponse(200, "application/json", 
                "{\"success\":true}");
            addCorsHeaders(response);
            request->send(response);
        }
    );
    
    // ============================================
    // CONFIG ENDPOINTS (3-tier redundancy)
    // ============================================
    
    // GET /api/config - Get current config
    server.on("/api/config", HTTP_GET, [](AsyncWebServerRequest *request) {
        if (!validateApiKey(request)) {
            AsyncWebServerResponse *response = request->beginResponse(401, "application/json", 
                "{\"success\":false,\"message\":\"Unauthorized\"}");
            addCorsHeaders(response);
            request->send(response);
            return;
        }
        
        DynamicJsonDocument doc(1024);
        doc["autoLockDuration"] = configuredAutoLockMs / 1000;
        
        // Card delays from NVS (use in-memory array)
        JsonArray cardDelays = doc.createNestedArray("cardDelays");
        for (uint8_t i = 0; i < userCardCount; i++) {
            String uidHex = "";
            for (byte j = 0; j < userCards[i].size; j++) {
                if (userCards[i].uid[j] < 0x10) uidHex += "0";
                uidHex += String(userCards[i].uid[j], HEX);
            }
            uidHex.toUpperCase();
            
            String delayKey = "d" + uidHex;
            if (delayKey.length() > 15) delayKey = delayKey.substring(0, 15);
            uint16_t delaySec = nvs.getUShort(delayKey.c_str(), 0);
            
            JsonObject entry = cardDelays.createNestedObject();
            entry["uid"] = uidToString(userCards[i].uid, userCards[i].size);
            entry["delay"] = delaySec;
        }
        
        String json;
        serializeJson(doc, json);
        
        AsyncWebServerResponse *response = request->beginResponse(200, "application/json", json);
        addCorsHeaders(response);
        request->send(response);
    });
    
    // POST /api/config/autolock - Set auto-lock duration
    server.on("/api/config/autolock", HTTP_POST, [](AsyncWebServerRequest *request) {}, NULL,
        [](AsyncWebServerRequest *request, uint8_t *data, size_t len, size_t index, size_t total) {
            if (!validateApiKey(request)) {
                AsyncWebServerResponse *response = request->beginResponse(401, "application/json", 
                    "{\"success\":false,\"message\":\"Unauthorized\"}");
                addCorsHeaders(response);
                request->send(response);
                return;
            }
            
            DynamicJsonDocument doc(256);
            DeserializationError error = deserializeJson(doc, (const char*)data, len);
            
            if (error || !doc.containsKey("duration")) {
                AsyncWebServerResponse *response = request->beginResponse(400, "application/json", 
                    "{\"success\":false,\"message\":\"Missing duration field\"}");
                addCorsHeaders(response);
                request->send(response);
                return;
            }
            
            uint16_t durationSec = doc["duration"].as<uint16_t>();
            if (durationSec < 1 || durationSec > 60) {
                AsyncWebServerResponse *response = request->beginResponse(400, "application/json", 
                    "{\"success\":false,\"message\":\"Duration must be 1-60 seconds\"}");
                addCorsHeaders(response);
                request->send(response);
                return;
            }
            
            // Apply immediately (tier 3: live)
            configuredAutoLockMs = (unsigned long)durationSec * 1000;
            
            // Save to NVS (tier 2: backup)
            saveAutoLockToNVS(durationSec);
            
            DEBUG_PRINTF("[Config] Auto-lock updated: %us\n", durationSec);
            
            DynamicJsonDocument responseDoc(256);
            responseDoc["success"] = true;
            responseDoc["duration"] = durationSec;
            
            String json;
            serializeJson(responseDoc, json);
            
            AsyncWebServerResponse *response = request->beginResponse(200, "application/json", json);
            addCorsHeaders(response);
            request->send(response);
            
            // Broadcast updated status
            broadcastDoorStatus();
        }
    );
    
    // POST /api/config/card-delay - Set card delay
    server.on("/api/config/card-delay", HTTP_POST, [](AsyncWebServerRequest *request) {}, NULL,
        [](AsyncWebServerRequest *request, uint8_t *data, size_t len, size_t index, size_t total) {
            if (!validateApiKey(request)) {
                AsyncWebServerResponse *response = request->beginResponse(401, "application/json", 
                    "{\"success\":false,\"message\":\"Unauthorized\"}");
                addCorsHeaders(response);
                request->send(response);
                return;
            }
            
            DynamicJsonDocument doc(256);
            DeserializationError error = deserializeJson(doc, (const char*)data, len);
            
            if (error || !doc.containsKey("uid") || !doc.containsKey("delay")) {
                AsyncWebServerResponse *response = request->beginResponse(400, "application/json", 
                    "{\"success\":false,\"message\":\"Missing uid or delay field\"}");
                addCorsHeaders(response);
                request->send(response);
                return;
            }
            
            String uidStr = doc["uid"].as<String>();
            uint16_t delaySec = doc["delay"].as<uint16_t>();
            
            if (delaySec > 30) {
                AsyncWebServerResponse *response = request->beginResponse(400, "application/json", 
                    "{\"success\":false,\"message\":\"Delay must be 0-30 seconds\"}");
                addCorsHeaders(response);
                request->send(response);
                return;
            }
            
            // Clean UID: remove colons
            uidStr.replace(":", "");
            uidStr.toUpperCase();
            
            // Save to NVS (tier 2: backup) — key: "d" + uidHex
            saveCardDelayToNVS(uidStr, delaySec);
            
            DEBUG_PRINTF("[Config] Card delay updated: %s = %us\n", uidStr.c_str(), delaySec);
            
            DynamicJsonDocument responseDoc(256);
            responseDoc["success"] = true;
            responseDoc["uid"] = uidStr;
            responseDoc["delay"] = delaySec;
            
            String json;
            serializeJson(responseDoc, json);
            
            AsyncWebServerResponse *response = request->beginResponse(200, "application/json", json);
            addCorsHeaders(response);
            request->send(response);
        }
    );

    // ============================================
    // RFID TOGGLE ENDPOINTS
    // ============================================

    // POST /api/rfid/toggle - Enable/disable RFID reader
    server.on("/api/rfid/toggle", HTTP_POST, [](AsyncWebServerRequest *request) {
        if (!validateApiKey(request)) {
            AsyncWebServerResponse *response = request->beginResponse(401, "application/json", 
                "{\"success\":false,\"message\":\"Unauthorized\"}");
            addCorsHeaders(response);
            request->send(response);
            return;
        }

        rfidDisabled = !rfidDisabled;
        rfidAutoEnableTime = 0; // Clear any timed disable on manual toggle
        nvs.putUChar(NVS_RFID_OFF_KEY, rfidDisabled ? 1 : 0);
        
        playBuzzerPattern(PATTERN_RFID_DISABLED);

        DEBUG_PRINTF("[API] RFID %s\n", rfidDisabled ? "DISABLED" : "ENABLED");

        DynamicJsonDocument doc(256);
        doc["success"] = true;
        doc["rfidDisabled"] = rfidDisabled;
        doc["rfidAutoEnableMs"] = 0;
        doc["message"] = rfidDisabled ? "RFID disabled" : "RFID enabled";

        String json;
        serializeJson(doc, json);

        AsyncWebServerResponse *response = request->beginResponse(200, "application/json", json);
        addCorsHeaders(response);
        request->send(response);

        lastEvent = rfidDisabled ? "RFID disabled (web)" : "RFID enabled (web)";
        broadcastDoorStatus();
    });

    // GET /api/rfid/status - Get RFID enable/disable status
    server.on("/api/rfid/status", HTTP_GET, [](AsyncWebServerRequest *request) {
        if (!validateApiKey(request)) {
            AsyncWebServerResponse *response = request->beginResponse(401, "application/json", 
                "{\"success\":false,\"message\":\"Unauthorized\"}");
            addCorsHeaders(response);
            request->send(response);
            return;
        }

        DynamicJsonDocument doc(128);
        doc["rfidDisabled"] = rfidDisabled;
        doc["rfidAutoEnableMs"] = (rfidDisabled && rfidAutoEnableTime > 0 && rfidAutoEnableTime > millis()) ? (rfidAutoEnableTime - millis()) : 0;

        String json;
        serializeJson(doc, json);

        AsyncWebServerResponse *response = request->beginResponse(200, "application/json", json);
        addCorsHeaders(response);
        request->send(response);
    });

    // POST /api/rfid/disable-timed - Disable RFID for N minutes then auto-enable
    server.on("/api/rfid/disable-timed", HTTP_POST, [](AsyncWebServerRequest *request){}, NULL,
        [](AsyncWebServerRequest *request, uint8_t *data, size_t len, size_t index, size_t total) {
        if (!validateApiKey(request)) {
            AsyncWebServerResponse *response = request->beginResponse(401, "application/json",
                "{\"success\":false,\"message\":\"Unauthorized\"}");
            addCorsHeaders(response);
            request->send(response);
            return;
        }

        DynamicJsonDocument body(256);
        if (deserializeJson(body, data, len)) {
            AsyncWebServerResponse *response = request->beginResponse(400, "application/json",
                "{\"success\":false,\"message\":\"Invalid JSON\"}");
            addCorsHeaders(response);
            request->send(response);
            return;
        }

        int minutes = body["minutes"] | 0;
        if (minutes < 1 || minutes > 60) {
            AsyncWebServerResponse *response = request->beginResponse(400, "application/json",
                "{\"success\":false,\"message\":\"minutes must be 1-60\"}");
            addCorsHeaders(response);
            request->send(response);
            return;
        }

        rfidDisabled = true;
        rfidAutoEnableTime = millis() + (unsigned long)minutes * 60UL * 1000UL;
        nvs.putUChar(NVS_RFID_OFF_KEY, 1);
        playBuzzerPattern(PATTERN_RFID_DISABLED);

        DEBUG_PRINTF("[API] RFID timed disable: %d min\n", minutes);

        unsigned long remainMs = rfidAutoEnableTime - millis();
        DynamicJsonDocument doc(256);
        doc["success"] = true;
        doc["rfidDisabled"] = true;
        doc["rfidAutoEnableMs"] = remainMs;
        doc["message"] = "RFID disabled for " + String(minutes) + " minutes";

        String json;
        serializeJson(doc, json);

        AsyncWebServerResponse *response = request->beginResponse(200, "application/json", json);
        addCorsHeaders(response);
        request->send(response);

        lastEvent = "RFID disabled (" + String(minutes) + "min)";
        broadcastDoorStatus();
    });

    // ============================================
    // SCHEDULED RESTART ENDPOINTS
    // ============================================

    // GET /api/schedule/restart - Get scheduled restart config
    server.on("/api/schedule/restart", HTTP_GET, [](AsyncWebServerRequest *request) {
        if (!validateApiKey(request)) {
            AsyncWebServerResponse *response = request->beginResponse(401, "application/json", 
                "{\"success\":false,\"message\":\"Unauthorized\"}");
            addCorsHeaders(response);
            request->send(response);
            return;
        }

        DynamicJsonDocument doc(256);
        doc["mode"] = scheduledRestartMode;
        doc["hour"] = scheduledRestartHour;
        doc["interval"] = scheduledRestartInterval;

        String json;
        serializeJson(doc, json);

        AsyncWebServerResponse *response = request->beginResponse(200, "application/json", json);
        addCorsHeaders(response);
        request->send(response);
    });

    // POST /api/schedule/restart - Set scheduled restart config
    server.on("/api/schedule/restart", HTTP_POST, [](AsyncWebServerRequest *request) {}, NULL,
        [](AsyncWebServerRequest *request, uint8_t *data, size_t len, size_t index, size_t total) {
            if (!validateApiKey(request)) {
                AsyncWebServerResponse *response = request->beginResponse(401, "application/json", 
                    "{\"success\":false,\"message\":\"Unauthorized\"}");
                addCorsHeaders(response);
                request->send(response);
                return;
            }

            DynamicJsonDocument doc(256);
            DeserializationError error = deserializeJson(doc, (const char*)data, len);

            if (error || !doc.containsKey("mode")) {
                AsyncWebServerResponse *response = request->beginResponse(400, "application/json", 
                    "{\"success\":false,\"message\":\"Missing mode field\"}");
                addCorsHeaders(response);
                request->send(response);
                return;
            }

            uint8_t mode = doc["mode"].as<uint8_t>();
            if (mode > 2) mode = 0;

            scheduledRestartMode = mode;
            nvs.putUChar(NVS_SCHED_MODE_KEY, mode);

            if (mode == 1 && doc.containsKey("hour")) {
                uint8_t hour = doc["hour"].as<uint8_t>();
                if (hour > 23) hour = 0;
                scheduledRestartHour = hour;
                nvs.putUChar(NVS_SCHED_HOUR_KEY, hour);
            }

            if (mode == 2 && doc.containsKey("interval")) {
                uint8_t interval = doc["interval"].as<uint8_t>();
                if (interval < 1) interval = 1;
                if (interval > 24) interval = 24;
                scheduledRestartInterval = interval;
                nvs.putUChar(NVS_SCHED_INTV_KEY, interval);
                lastRestartCheckTime = millis();  // Reset timer
            }

            DEBUG_PRINTF("[Schedule] Restart mode=%d hour=%d interval=%dh\n", 
                        scheduledRestartMode, scheduledRestartHour, scheduledRestartInterval);

            DynamicJsonDocument responseDoc(256);
            responseDoc["success"] = true;
            responseDoc["mode"] = scheduledRestartMode;
            responseDoc["hour"] = scheduledRestartHour;
            responseDoc["interval"] = scheduledRestartInterval;

            String json;
            serializeJson(responseDoc, json);

            AsyncWebServerResponse *response = request->beginResponse(200, "application/json", json);
            addCorsHeaders(response);
            request->send(response);

            lastEvent = "Scheduled restart updated (web)";
        }
    );

    // ============================================
    // CARD DELAY SCHEDULE ENDPOINTS
    // ============================================

    // GET /api/config/card-schedule - Read all saved card schedules from NVS
    server.on("/api/config/card-schedule", HTTP_GET, [](AsyncWebServerRequest *request) {
        if (!validateApiKey(request)) {
            AsyncWebServerResponse *response = request->beginResponse(401, "application/json", 
                "{\"success\":false,\"message\":\"Unauthorized\"}");
            addCorsHeaders(response);
            request->send(response);
            return;
        }

        DynamicJsonDocument doc(4096);
        doc["success"] = true;
        doc["ntpSynced"] = ntpSynced;
        doc["currentHour"] = getCurrentHour();

        JsonArray arr = doc.createNestedArray("schedules");
        for (uint8_t i = 0; i < userCardCount; i++) {
            String uidStr = uidToString(userCards[i].uid, userCards[i].size);
            String uidHex = uidStr;
            uidHex.replace(":", "");
            String schedKey = "s" + uidHex;
            schedKey.toUpperCase();
            if (schedKey.length() > 15) schedKey = schedKey.substring(0, 15);

            uint8_t schedData[3] = {0};
            size_t schedLen = nvs.getBytesLength(schedKey.c_str());
            if (schedLen == 3) {
                nvs.getBytes(schedKey.c_str(), schedData, 3);
                JsonObject sched = arr.createNestedObject();
                sched["uid"] = uidStr;
                sched["startHour"] = schedData[0];
                sched["endHour"] = schedData[1];
                sched["delaySec"] = schedData[2];
            }
        }

        String json;
        serializeJson(doc, json);
        AsyncWebServerResponse *response = request->beginResponse(200, "application/json", json);
        addCorsHeaders(response);
        request->send(response);
    });

    // POST /api/config/card-schedule - Push card delay schedule to ESP32
    server.on("/api/config/card-schedule", HTTP_POST, [](AsyncWebServerRequest *request) {}, NULL,
        [](AsyncWebServerRequest *request, uint8_t *data, size_t len, size_t index, size_t total) {
            if (!validateApiKey(request)) {
                AsyncWebServerResponse *response = request->beginResponse(401, "application/json", 
                    "{\"success\":false,\"message\":\"Unauthorized\"}");
                addCorsHeaders(response);
                request->send(response);
                return;
            }

            DynamicJsonDocument doc(4096);
            DeserializationError error = deserializeJson(doc, (const char*)data, len);

            if (error) {
                AsyncWebServerResponse *response = request->beginResponse(400, "application/json", 
                    "{\"success\":false,\"message\":\"Invalid JSON\"}");
                addCorsHeaders(response);
                request->send(response);
                return;
            }

            // Support single schedule: {uid, startHour, endHour, delaySec}
            // Support remove: {uid, remove: true}
            if (doc.containsKey("uid")) {
                String uidStr = doc["uid"].as<String>();
                uidStr.replace(":", "");
                uidStr.toUpperCase();

                if (doc.containsKey("remove") && doc["remove"].as<bool>()) {
                    removeCardScheduleFromNVS(uidStr);
                } else if (doc.containsKey("startHour") && doc.containsKey("endHour") && doc.containsKey("delaySec")) {
                    uint8_t startH = doc["startHour"].as<uint8_t>();
                    uint8_t endH = doc["endHour"].as<uint8_t>();
                    uint8_t delayS = doc["delaySec"].as<uint8_t>();
                    if (startH > 23) startH = 0;
                    if (endH > 23) endH = 0;
                    if (delayS > 30) delayS = 30;
                    saveCardScheduleToNVS(uidStr, startH, endH, delayS);
                }
            }

            // Support bulk: {schedules: [{uid, startHour, endHour, delaySec}, ...]}
            if (doc.containsKey("schedules")) {
                JsonArray schedules = doc["schedules"].as<JsonArray>();
                for (JsonVariant v : schedules) {
                    String uid = v["uid"].as<String>();
                    uid.replace(":", "");
                    uid.toUpperCase();
                    
                    if (v.containsKey("remove") && v["remove"].as<bool>()) {
                        removeCardScheduleFromNVS(uid);
                    } else {
                        uint8_t sH = v["startHour"].as<uint8_t>();
                        uint8_t eH = v["endHour"].as<uint8_t>();
                        uint8_t dS = v["delaySec"].as<uint8_t>();
                        if (sH > 23) sH = 0;
                        if (eH > 23) eH = 0;
                        if (dS > 30) dS = 30;
                        saveCardScheduleToNVS(uid, sH, eH, dS);
                    }
                }
            }

            AsyncWebServerResponse *response = request->beginResponse(200, "application/json", 
                "{\"success\":true}");
            addCorsHeaders(response);
            request->send(response);
        }
    );

    // ============================================
    // CLONE MODE ENDPOINTS
    // ============================================

    // GET /api/clone/status - Get clone mode status
    server.on("/api/clone/status", HTTP_GET, [](AsyncWebServerRequest *request) {
        if (!validateApiKey(request)) {
            AsyncWebServerResponse *response = request->beginResponse(401, "application/json", 
                "{\"success\":false,\"message\":\"Unauthorized\"}");
            addCorsHeaders(response);
            request->send(response);
            return;
        }

        DynamicJsonDocument doc(512);
        doc["success"] = true;
        doc["state"] = stateToString(currentState);

        if (currentState == STATE_CLONE_MODE) {
            doc["step"] = (currentCloneStep == CLONE_WAIT_SOURCE) ? "WAIT_SOURCE" : "WAIT_TARGET";
            if (currentCloneStep == CLONE_WAIT_TARGET && cloneSourceSize > 0) {
                doc["sourceUID"] = uidToString(cloneSourceUID, cloneSourceSize);
            }
            doc["cloneResult"] = "none";
        } else {
            doc["step"] = "NONE";
            // Check if there's a recent clone result (within 5 seconds)
            if (cloneLastResult != "none" && (millis() - cloneResultTime) < 5000) {
                doc["cloneResult"] = cloneLastResult;
                if (cloneSourceSize > 0) {
                    doc["sourceUID"] = uidToString(cloneSourceUID, cloneSourceSize);
                }
            } else {
                doc["cloneResult"] = "none";
            }
        }

        String json;
        serializeJson(doc, json);

        AsyncWebServerResponse *response = request->beginResponse(200, "application/json", json);
        addCorsHeaders(response);
        request->send(response);
    });

    // POST /api/clone/start - Enter clone mode
    server.on("/api/clone/start", HTTP_POST, [](AsyncWebServerRequest *request) {
        if (!validateApiKey(request)) {
            AsyncWebServerResponse *response = request->beginResponse(401, "application/json", 
                "{\"success\":false,\"message\":\"Unauthorized\"}");
            addCorsHeaders(response);
            request->send(response);
            return;
        }

        DynamicJsonDocument doc(256);

        if (currentState == STATE_CLONE_MODE) {
            doc["success"] = false;
            doc["message"] = "Already in clone mode";
        } else if (currentState != STATE_IDLE) {
            doc["success"] = false;
            doc["message"] = "System busy, current state: " + stateToString(currentState);
        } else {
            DEBUG_PRINTLN("[CLONE] Clone mode activated via web");
            playBuzzerPattern(PATTERN_ENTER_REG_MODE);
            currentCloneStep = CLONE_WAIT_SOURCE;
            currentState = STATE_CLONE_MODE;
            lastActivityTime = millis();
            lastScanTime = 0;
            cloneLastResult = "none";
            lastEvent = "Clone mode activated (web)";

            doc["success"] = true;
            doc["message"] = "Clone mode activated. Tap source card.";
        }

        String json;
        serializeJson(doc, json);

        AsyncWebServerResponse *response = request->beginResponse(200, "application/json", json);
        addCorsHeaders(response);
        request->send(response);

        broadcastDoorStatus();
    });

    // POST /api/clone/cancel - Cancel clone mode
    server.on("/api/clone/cancel", HTTP_POST, [](AsyncWebServerRequest *request) {
        if (!validateApiKey(request)) {
            AsyncWebServerResponse *response = request->beginResponse(401, "application/json", 
                "{\"success\":false,\"message\":\"Unauthorized\"}");
            addCorsHeaders(response);
            request->send(response);
            return;
        }

        DynamicJsonDocument doc(256);

        if (currentState == STATE_CLONE_MODE) {
            DEBUG_PRINTLN("[CLONE] Clone mode cancelled via web");
            playBuzzerPattern(PATTERN_EXIT_REG_MODE);
            currentState = STATE_IDLE;
            lastEvent = "Clone mode cancelled (web)";

            doc["success"] = true;
            doc["message"] = "Clone mode cancelled";
        } else {
            doc["success"] = false;
            doc["message"] = "Not in clone mode";
        }

        String json;
        serializeJson(doc, json);

        AsyncWebServerResponse *response = request->beginResponse(200, "application/json", json);
        addCorsHeaders(response);
        request->send(response);

        broadcastDoorStatus();
    });
}

// ============================================
// WEBSOCKET
// ============================================

void setupWebSocket(AsyncWebServer& server) {
    ws.onEvent(onWebSocketEvent);
    
    #if ENABLE_API_AUTH
        // Authenticate WebSocket at HTTP level before upgrade
        // setFilter runs during canHandle() - before the connection is upgraded
        ws.setFilter([](AsyncWebServerRequest *request) -> bool {
            if (!request->hasParam("apikey")) {
                DEBUG_PRINTLN("[WebSocket] Rejected - missing apikey param");
                return false;
            }
            String providedKey = request->getParam("apikey")->value();
            if (providedKey != String(API_KEY)) {
                DEBUG_PRINTLN("[WebSocket] Rejected - invalid API key");
                return false;
            }
            return true;
        });
    #endif
    
    server.addHandler(&ws);
    
    #if ENABLE_API_AUTH
        // Fallback handler: if WebSocket filter rejected (auth failed), return 401
        server.on("/ws", HTTP_GET, [](AsyncWebServerRequest *request) {
            AsyncWebServerResponse *response = request->beginResponse(401, "application/json",
                "{\"success\":false,\"message\":\"Unauthorized - Invalid or missing API key\"}");
            addCorsHeaders(response);
            request->send(response);
        });
    #endif
    
    DEBUG_PRINTLN("[WebSocket] WebSocket server initialized");
}

void onWebSocketEvent(AsyncWebSocket* server, AsyncWebSocketClient* client, 
                      AwsEventType type, void* arg, uint8_t* data, size_t len) {
    switch (type) {
        case WS_EVT_CONNECT: {
            // Auth already validated by setFilter before upgrade
            DEBUG_PRINTF("[WebSocket] Client #%u connected from %s\n", 
                        client->id(), client->remoteIP().toString().c_str());
            // Send initial status
            broadcastDoorStatus();
            break;
        }
            
        case WS_EVT_DISCONNECT:
            DEBUG_PRINTF("[WebSocket] Client #%u disconnected\n", client->id());
            break;
            
        case WS_EVT_DATA:
            // Handle incoming messages if needed
            break;
            
        case WS_EVT_PONG:
        case WS_EVT_ERROR:
            break;
    }
}

void broadcastDoorStatus() {
    String stateStr = stateToString(currentState);
    
    DynamicJsonDocument doc(512);
    doc["type"] = "door_status";
    doc["timestamp"] = millis();
    
    JsonObject data = doc.createNestedObject("data");
    data["doorUnlocked"] = doorUnlocked;
    data["doorStatus"] = doorUnlocked ? "UNLOCKED" : "LOCKED";
    data["state"] = stateStr;
    data["lastCard"] = lastCardUID;
    data["lastEvent"] = lastEvent;
    data["cardCount"] = userCardCount;
    data["uptime"] = String((millis() - systemStartTime) / 1000) + "s";
    data["autoLockDuration"] = configuredAutoLockMs / 1000;
    data["rfidDisabled"] = rfidDisabled;
    data["rfidAutoEnableMs"] = (rfidDisabled && rfidAutoEnableTime > 0 && rfidAutoEnableTime > millis()) ? (rfidAutoEnableTime - millis()) : 0;

    // Include time info for dashboard sync
    struct tm ti;
    if (getLocalTime(&ti, 50)) {
        char timeBuf[20];
        snprintf(timeBuf, sizeof(timeBuf), "%02d:%02d:%02d", ti.tm_hour, ti.tm_min, ti.tm_sec);
        data["currentTime"] = timeBuf;
        data["currentHour"] = ti.tm_hour;
    }
    data["ntpSynced"] = ntpSynced;
    
    String json;
    serializeJson(doc, json);
    
    ws.textAll(json);
}

void broadcastCardScan(const String& uid, bool success) {
    DynamicJsonDocument doc(512);
    doc["type"] = "card_scan";
    doc["timestamp"] = millis();
    
    JsonObject data = doc.createNestedObject("data");
    data["uid"] = uid;
    data["success"] = success;
    
    String json;
    serializeJson(doc, json);
    
    ws.textAll(json);
    DEBUG_PRINTF("[WebSocket] Broadcast card scan: %s (%s)\n", 
                uid.c_str(), success ? "success" : "denied");
}

void broadcastCardAdded(const String& uid) {
    DynamicJsonDocument doc(512);
    doc["type"] = "card_added";
    doc["timestamp"] = millis();
    
    JsonObject data = doc.createNestedObject("data");
    data["uid"] = uid;
    data["cardCount"] = userCardCount;
    
    // Include full card list for instant sync
    JsonArray cards = data.createNestedArray("allCards");
    for (uint8_t i = 0; i < userCardCount; i++) {
        cards.add(uidToString(userCards[i].uid, userCards[i].size));
    }
    
    String json;
    serializeJson(doc, json);
    
    ws.textAll(json);
    DEBUG_PRINTF("[WebSocket] Broadcast card added: %s\n", uid.c_str());
}

void broadcastCardRemoved(const String& uid) {
    DynamicJsonDocument doc(512);
    doc["type"] = "card_removed";
    doc["timestamp"] = millis();
    
    JsonObject data = doc.createNestedObject("data");
    data["uid"] = uid;
    data["cardCount"] = userCardCount;
    
    // Include full card list for instant sync
    JsonArray cards = data.createNestedArray("allCards");
    for (uint8_t i = 0; i < userCardCount; i++) {
        cards.add(uidToString(userCards[i].uid, userCards[i].size));
    }
    
    String json;
    serializeJson(doc, json);
    
    ws.textAll(json);
    DEBUG_PRINTF("[WebSocket] Broadcast card removed: %s\n", uid.c_str());
}

void broadcastRegistrationMode(bool active) {
    DynamicJsonDocument doc(256);
    doc["type"] = "registration_mode";
    doc["timestamp"] = millis();
    
    JsonObject data = doc.createNestedObject("data");
    data["active"] = active;
    
    String json;
    serializeJson(doc, json);
    
    ws.textAll(json);
    DEBUG_PRINTF("[WebSocket] Broadcast registration mode: %s\n", active ? "ON" : "OFF");
}

void handleWebSocketTasks() {
    ws.cleanupClients();
}

void broadcastCloneStatus(const String& step, const String& sourceUID, const String& result) {
    DynamicJsonDocument doc(512);
    doc["type"] = "clone_status";
    doc["timestamp"] = millis();

    JsonObject data = doc.createNestedObject("data");
    data["state"] = stateToString(currentState);
    data["step"] = step;
    if (sourceUID.length() > 0) {
        data["sourceUID"] = sourceUID;
    }
    if (result.length() > 0) {
        data["result"] = result;
    }

    String json;
    serializeJson(doc, json);

    ws.textAll(json);
    DEBUG_PRINTF("[WebSocket] Broadcast clone status: step=%s result=%s\n", 
                step.c_str(), result.length() > 0 ? result.c_str() : "none");
}
