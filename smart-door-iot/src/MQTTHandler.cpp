#include "MQTTHandler.h"
#include "GlobalState.h"
#include "CardManager.h"
#include "DoorController.h"
#include "BuzzerController.h"
#include "OTAUpdate.h"
#include "config.h"
#include <WiFi.h>
#include <esp_ota_ops.h>

// ============================================
// MQTT CLIENT
// ============================================

#if MQTT_USE_TLS
WiFiClientSecure espClient;
#else
WiFiClient espClient;
#endif
PubSubClient mqtt(espClient);

static unsigned long lastReconnectAttempt = 0;
static unsigned long lastStatusPublish = 0;
static unsigned long lastSystemInfoPublish = 0;

// Global serialization buffer — avoids large char arrays on stack
static char mqttBuf[2048];

#define STATUS_PUBLISH_INTERVAL   5000   // Publish status every 5s
#define SYSTEM_INFO_INTERVAL      30000  // Publish system info every 30s
#define MQTT_RECONNECT_INTERVAL   5000   // Reconnect attempt every 5s

// ============================================
// FORWARD DECLARATIONS
// ============================================

static void sendResponse(const String& requestId, bool success, const String& message);
static void buildStatusJson(JsonDocument& doc);
static void parseUidString(const String& uidStr, byte* uidBytes, byte& uidSize);

// ============================================
// MQTT CALLBACK — handle incoming commands
// ============================================

static void mqttCallback(char* topic, byte* payload, unsigned int length) {
    // Parse JSON payload — use DynamicJsonDocument (heap) to save stack space
    DynamicJsonDocument doc(2048);
    DeserializationError err = deserializeJson(doc, payload, length);
    
    String topicStr(topic);
    
    // Handle OTA data (binary, not JSON)
    if (topicStr == TOPIC_OTA_DATA) {
        if (mqttOtaInProgress) {
            otaWriteChunk(payload, length);
        }
        return;
    }
    
    if (err) {
        DEBUG_PRINTF("[MQTT] JSON parse error on %s: %s\n", topic, err.c_str());
        return;
    }
    
    String requestId = doc["requestId"] | "";
    
    DEBUG_PRINTF("[MQTT] Command on %s (reqId: %s)\n", topic, requestId.c_str());
    
    // ── Door Commands ──
    if (topicStr == TOPIC_CMD_DOOR) {
        String action = doc["action"] | "";
        
        if (action == "unlock") {
            if (currentState == STATE_IDLE || currentState == STATE_UNLOCK) {
                unlockDoor();
                currentState = STATE_UNLOCK;
                stateStartTime = millis();
                lastEvent = "Door unlocked (MQTT)";
                publishDoorStatus();
                publishAccessLog("MQTT", "unlock", true, "WEB");
                sendResponse(requestId, true, "Door unlocked");
            } else {
                sendResponse(requestId, false, "Cannot unlock: system busy");
            }
        }
        else if (action == "lock") {
            lockDoor();
            currentState = STATE_IDLE;
            lastEvent = "Door locked (MQTT)";
            publishDoorStatus();
            sendResponse(requestId, true, "Door locked");
        }
        else if (action == "status") {
            // Return full status via response
            DynamicJsonDocument resp(1024);
            resp["requestId"] = requestId;
            resp["success"] = true;
            buildStatusJson(resp);
            serializeJson(resp, mqttBuf, sizeof(mqttBuf));
            mqtt.publish(TOPIC_RESPONSE, mqttBuf);
        }
        else {
            sendResponse(requestId, false, "Unknown door action");
        }
    }
    
    // ── Card Commands ──
    else if (topicStr == TOPIC_CMD_CARDS) {
        String action = doc["action"] | "";
        
        if (action == "list") {
            DynamicJsonDocument resp(2048);
            resp["requestId"] = requestId;
            resp["success"] = true;
            JsonArray cards = resp.createNestedArray("cards");
            for (uint8_t i = 0; i < userCardCount; i++) {
                String uid = uidToString(userCards[i].uid, userCards[i].size);
                cards.add(uid);
            }
            resp["count"] = userCardCount;
            serializeJson(resp, mqttBuf, sizeof(mqttBuf));
            mqtt.publish(TOPIC_RESPONSE, mqttBuf);
        }
        else if (action == "add") {
            String uid = doc["uid"] | "";
            if (uid.length() == 0) {
                sendResponse(requestId, false, "Missing uid");
                return;
            }
            // Parse UID string to bytes
            byte uidBytes[UID_MAX_SIZE];
            byte uidSize = 0;
            parseUidString(uid, uidBytes, uidSize);
            
            if (uidSize == 0) {
                sendResponse(requestId, false, "Invalid UID format");
                return;
            }
            if (isMasterCard(uidBytes, uidSize)) {
                sendResponse(requestId, false, "Cannot add master card");
                return;
            }
            if (isCardRegistered(uidBytes, uidSize)) {
                sendResponse(requestId, false, "Card already registered");
                return;
            }
            if (addCardToNVS(uidBytes, uidSize)) {
                playBuzzerPattern(PATTERN_ADD_SUCCESS);
                String formattedUid = uidToString(uidBytes, uidSize);
                publishCardAdded(formattedUid);
                
                StaticJsonDocument<512> resp;
                resp["requestId"] = requestId;
                resp["success"] = true;
                resp["message"] = "Card added";
                resp["count"] = userCardCount;
                char buf[512];
                serializeJson(resp, buf, sizeof(buf));
                mqtt.publish(TOPIC_RESPONSE, buf);
            } else {
                sendResponse(requestId, false, "Failed to add card (full?)");
            }
        }
        else if (action == "remove") {
            String uid = doc["uid"] | "";
            byte uidBytes[UID_MAX_SIZE];
            byte uidSize = 0;
            parseUidString(uid, uidBytes, uidSize);
            
            if (uidSize == 0) {
                sendResponse(requestId, false, "Invalid UID format");
                return;
            }
            if (removeCardFromNVS(uidBytes, uidSize)) {
                playBuzzerPattern(PATTERN_REMOVE_SUCCESS);
                String formattedUid = uidToString(uidBytes, uidSize);
                publishCardRemoved(formattedUid);
                
                StaticJsonDocument<512> resp;
                resp["requestId"] = requestId;
                resp["success"] = true;
                resp["count"] = userCardCount;
                char buf[512];
                serializeJson(resp, buf, sizeof(buf));
                mqtt.publish(TOPIC_RESPONSE, buf);
            } else {
                sendResponse(requestId, false, "Card not found");
            }
        }
        else if (action == "sync") {
            JsonArray uids = doc["uids"].as<JsonArray>();
            if (uids.isNull()) {
                sendResponse(requestId, false, "Missing uids array");
                return;
            }
            syncCardsFromList(uids);
            publishDoorStatus();
            
            StaticJsonDocument<256> resp;
            resp["requestId"] = requestId;
            resp["success"] = true;
            resp["message"] = "Cards synced";
            resp["count"] = userCardCount;
            char buf[256];
            serializeJson(resp, buf, sizeof(buf));
            mqtt.publish(TOPIC_RESPONSE, buf);
        }
        else {
            sendResponse(requestId, false, "Unknown cards action");
        }
    }
    
    // ── Config Commands ──
    else if (topicStr == TOPIC_CMD_CONFIG) {
        String action = doc["action"] | "";
        
        if (action == "get") {
            DynamicJsonDocument resp(2048);
            resp["requestId"] = requestId;
            resp["success"] = true;
            resp["autoLockDuration"] = configuredAutoLockMs / 1000;
            
            // Card delays
            JsonArray delays = resp.createNestedArray("cardDelays");
            for (uint8_t i = 0; i < userCardCount; i++) {
                String uid = uidToString(userCards[i].uid, userCards[i].size);
                String uidHex = uid;
                uidHex.replace(":", "");
                String key = "d" + uidHex;
                uint16_t delaySec = nvs.getUShort(key.c_str(), 0);
                if (delaySec > 0) {
                    JsonObject d = delays.createNestedObject();
                    d["uid"] = uid;
                    d["delay"] = delaySec;
                }
            }
            
            serializeJson(resp, mqttBuf, sizeof(mqttBuf));
            mqtt.publish(TOPIC_RESPONSE, mqttBuf);
        }
        else if (action == "set_autolock") {
            int duration = doc["duration"] | 0;
            if (duration < 1 || duration > 60) {
                sendResponse(requestId, false, "Duration must be 1-60 seconds");
                return;
            }
            saveAutoLockToNVS((uint16_t)duration);
            publishDoorStatus();
            
            StaticJsonDocument<256> resp;
            resp["requestId"] = requestId;
            resp["success"] = true;
            resp["duration"] = duration;
            char buf[256];
            serializeJson(resp, buf, sizeof(buf));
            mqtt.publish(TOPIC_RESPONSE, buf);
        }
        else if (action == "set_card_delay") {
            String uid = doc["uid"] | "";
            int delaySec = doc["delay"] | -1;
            if (uid.length() == 0 || delaySec < 0 || delaySec > 30) {
                sendResponse(requestId, false, "Invalid uid or delay (0-30)");
                return;
            }
            String uidHex = uid;
            uidHex.replace(":", "");
            saveCardDelayToNVS(uidHex, (uint16_t)delaySec);
            
            StaticJsonDocument<256> resp;
            resp["requestId"] = requestId;
            resp["success"] = true;
            resp["uid"] = uid;
            resp["delay"] = delaySec;
            char buf[256];
            serializeJson(resp, buf, sizeof(buf));
            mqtt.publish(TOPIC_RESPONSE, buf);
        }
        else if (action == "get_schedules") {
            DynamicJsonDocument resp(2048);
            resp["requestId"] = requestId;
            resp["success"] = true;
            resp["ntpSynced"] = ntpSynced;
            resp["currentHour"] = getCurrentHour();
            
            JsonArray schedules = resp.createNestedArray("schedules");
            for (uint8_t i = 0; i < userCardCount; i++) {
                String uid = uidToString(userCards[i].uid, userCards[i].size);
                String uidHex = uid;
                uidHex.replace(":", "");
                String key = "s" + uidHex;
                uint8_t schedData[3] = {0};
                size_t len = nvs.getBytes(key.c_str(), schedData, 3);
                if (len == 3 && (schedData[0] != 0 || schedData[1] != 0 || schedData[2] != 0)) {
                    JsonObject s = schedules.createNestedObject();
                    s["uid"] = uid;
                    s["startHour"] = schedData[0];
                    s["endHour"] = schedData[1];
                    s["delaySec"] = schedData[2];
                }
            }
            
            serializeJson(resp, mqttBuf, sizeof(mqttBuf));
            mqtt.publish(TOPIC_RESPONSE, mqttBuf);
        }
        else if (action == "set_schedule") {
            // Single schedule or bulk
            if (doc.containsKey("schedules")) {
                JsonArray arr = doc["schedules"].as<JsonArray>();
                for (JsonObject s : arr) {
                    String uid = s["uid"] | "";
                    String uidHex = uid;
                    uidHex.replace(":", "");
                    if (s["remove"] | false) {
                        removeCardScheduleFromNVS(uidHex);
                    } else {
                        uint8_t sh = s["startHour"] | 0;
                        uint8_t eh = s["endHour"] | 0;
                        uint8_t ds = s["delaySec"] | 0;
                        saveCardScheduleToNVS(uidHex, sh, eh, ds);
                    }
                }
                sendResponse(requestId, true, "Schedules updated");
            } else {
                String uid = doc["uid"] | "";
                String uidHex = uid;
                uidHex.replace(":", "");
                if (doc["remove"] | false) {
                    removeCardScheduleFromNVS(uidHex);
                    sendResponse(requestId, true, "Schedule removed");
                } else {
                    uint8_t sh = doc["startHour"] | 0;
                    uint8_t eh = doc["endHour"] | 0;
                    uint8_t ds = doc["delaySec"] | 0;
                    saveCardScheduleToNVS(uidHex, sh, eh, ds);
                    sendResponse(requestId, true, "Schedule saved");
                }
            }
        }
        else {
            sendResponse(requestId, false, "Unknown config action");
        }
    }
    
    // ── Mode Commands ──
    else if (topicStr == TOPIC_CMD_MODE) {
        String action = doc["action"] | "";
        
        if (action == "register") {
            if (currentState == STATE_REGISTRATION_MODE) {
                // Exit registration mode
                playBuzzerPattern(PATTERN_EXIT_REG_MODE);
                currentState = STATE_IDLE;
                lastEvent = "Registration mode exited (MQTT)";
                publishRegistrationMode(false);
                publishDoorStatus();
                sendResponse(requestId, true, "Registration mode deactivated");
            } else if (currentState == STATE_IDLE) {
                playBuzzerPattern(PATTERN_ENTER_REG_MODE);
                currentState = STATE_REGISTRATION_MODE;
                lastActivityTime = millis();
                lastEvent = "Registration mode entered (MQTT)";
                publishRegistrationMode(true);
                publishDoorStatus();
                sendResponse(requestId, true, "Registration mode activated");
            } else {
                sendResponse(requestId, false, "System busy, cannot change mode");
            }
        }
        else if (action == "clone_start") {
            if (currentState == STATE_IDLE) {
                currentCloneStep = CLONE_WAIT_SOURCE;
                currentState = STATE_CLONE_MODE;
                lastActivityTime = millis();
                lastScanTime = 0;
                lastEvent = "Clone mode activated (MQTT)";
                playBuzzerPattern(PATTERN_ENTER_REG_MODE);
                publishCloneStatus("WAIT_SOURCE");
                sendResponse(requestId, true, "Clone mode started");
            } else {
                sendResponse(requestId, false, "System busy");
            }
        }
        else if (action == "clone_cancel") {
            if (currentState == STATE_CLONE_MODE) {
                currentState = STATE_IDLE;
                lastEvent = "Clone mode cancelled (MQTT)";
                playBuzzerPattern(PATTERN_EXIT_REG_MODE);
                publishCloneStatus("CANCELLED");
                publishDoorStatus();
                sendResponse(requestId, true, "Clone mode cancelled");
            } else {
                sendResponse(requestId, false, "Not in clone mode");
            }
        }
        else if (action == "clone_status") {
            StaticJsonDocument<512> resp;
            resp["requestId"] = requestId;
            resp["success"] = true;
            resp["state"] = (currentState == STATE_CLONE_MODE) ? "CLONE_MODE" : "IDLE";
            resp["step"] = (currentCloneStep == CLONE_WAIT_SOURCE) ? "WAIT_SOURCE" : "WAIT_TARGET";
            if (cloneSourceSize > 0) {
                resp["sourceUID"] = uidToString(cloneSourceUID, cloneSourceSize);
            }
            resp["cloneResult"] = cloneLastResult;
            char buf[512];
            serializeJson(resp, buf, sizeof(buf));
            mqtt.publish(TOPIC_RESPONSE, buf);
        }
        else {
            sendResponse(requestId, false, "Unknown mode action");
        }
    }
    
    // ── RFID Commands ──
    else if (topicStr == TOPIC_CMD_RFID) {
        String action = doc["action"] | "";
        
        if (action == "toggle") {
            rfidDisabled = !rfidDisabled;
            rfidAutoEnableTime = 0;
            nvs.putUChar(NVS_RFID_OFF_KEY, rfidDisabled ? 1 : 0);
            playBuzzerPattern(PATTERN_RFID_DISABLED);
            lastEvent = rfidDisabled ? "RFID disabled (MQTT)" : "RFID enabled (MQTT)";
            publishDoorStatus();
            
            StaticJsonDocument<256> resp;
            resp["requestId"] = requestId;
            resp["success"] = true;
            resp["rfidDisabled"] = rfidDisabled;
            resp["rfidAutoEnableMs"] = 0;
            resp["message"] = rfidDisabled ? "RFID disabled" : "RFID enabled";
            char buf[256];
            serializeJson(resp, buf, sizeof(buf));
            mqtt.publish(TOPIC_RESPONSE, buf);
        }
        else if (action == "status") {
            StaticJsonDocument<256> resp;
            resp["requestId"] = requestId;
            resp["success"] = true;
            resp["rfidDisabled"] = rfidDisabled;
            resp["rfidAutoEnableMs"] = (rfidAutoEnableTime > 0 && rfidAutoEnableTime > millis()) 
                ? (rfidAutoEnableTime - millis()) : 0;
            char buf[256];
            serializeJson(resp, buf, sizeof(buf));
            mqtt.publish(TOPIC_RESPONSE, buf);
        }
        else if (action == "disable_timed") {
            int minutes = doc["minutes"] | 0;
            if (minutes < 1 || minutes > 60) {
                sendResponse(requestId, false, "Minutes must be 1-60");
                return;
            }
            rfidDisabled = true;
            rfidAutoEnableTime = millis() + ((unsigned long)minutes * 60000);
            nvs.putUChar(NVS_RFID_OFF_KEY, 1);
            playBuzzerPattern(PATTERN_RFID_DISABLED);
            lastEvent = "RFID disabled " + String(minutes) + "m (MQTT)";
            publishDoorStatus();
            
            StaticJsonDocument<256> resp;
            resp["requestId"] = requestId;
            resp["success"] = true;
            resp["rfidDisabled"] = true;
            resp["rfidAutoEnableMs"] = (unsigned long)minutes * 60000;
            resp["message"] = "RFID disabled for " + String(minutes) + " minutes";
            char buf[256];
            serializeJson(resp, buf, sizeof(buf));
            mqtt.publish(TOPIC_RESPONSE, buf);
        }
        else {
            sendResponse(requestId, false, "Unknown RFID action");
        }
    }
    
    // ── System Commands ──
    else if (topicStr == TOPIC_CMD_SYSTEM) {
        String action = doc["action"] | "";
        
        if (action == "info") {
            publishSystemInfo();
            sendResponse(requestId, true, "System info published");
        }
        else if (action == "restart") {
            sendResponse(requestId, true, "Restarting...");
            lastEvent = "Restart requested (MQTT)";
            delay(500);
            lockDoor();
            delay(500);
            ESP.restart();
        }
        else if (action == "buzzer") {
            String pattern = doc["pattern"] | "";
            if (pattern == "VALID_CARD") playBuzzerPattern(PATTERN_VALID_CARD);
            else if (pattern == "INVALID_CARD") playBuzzerPattern(PATTERN_INVALID_CARD);
            else if (pattern == "UNLOCKED") playBuzzerPattern(PATTERN_INIT_OK);
            else {
                sendResponse(requestId, false, "Unknown buzzer pattern");
                return;
            }
            sendResponse(requestId, true, "Buzzer played");
        }
        else {
            sendResponse(requestId, false, "Unknown system action");
        }
    }
    
    // ── Time Commands ──
    else if (topicStr == TOPIC_CMD_TIME) {
        String action = doc["action"] | "";
        
        if (action == "get") {
            StaticJsonDocument<512> resp;
            resp["requestId"] = requestId;
            resp["success"] = true;
            
            struct tm timeInfo;
            if (getLocalTime(&timeInfo, 100)) {
                resp["ntpSynced"] = ntpSynced;
                resp["hour"] = timeInfo.tm_hour;
                resp["minute"] = timeInfo.tm_min;
                resp["second"] = timeInfo.tm_sec;
                resp["day"] = timeInfo.tm_mday;
                resp["month"] = timeInfo.tm_mon + 1;
                resp["year"] = timeInfo.tm_year + 1900;
                
                char timeBuf[16], dateBuf[16];
                snprintf(timeBuf, sizeof(timeBuf), "%02d:%02d:%02d", timeInfo.tm_hour, timeInfo.tm_min, timeInfo.tm_sec);
                snprintf(dateBuf, sizeof(dateBuf), "%04d-%02d-%02d", timeInfo.tm_year + 1900, timeInfo.tm_mon + 1, timeInfo.tm_mday);
                resp["time"] = timeBuf;
                resp["date"] = dateBuf;
                
                time_t epoch;
                time(&epoch);
                resp["epoch"] = (unsigned long)epoch;
            } else {
                resp["ntpSynced"] = false;
                resp["message"] = "Time not available";
            }
            
            char buf[512];
            serializeJson(resp, buf, sizeof(buf));
            mqtt.publish(TOPIC_RESPONSE, buf);
        }
        else if (action == "sync") {
            configTzTime(NTP_TIMEZONE, NTP_SERVER_1, NTP_SERVER_2);
            struct tm timeInfo;
            bool synced = getLocalTime(&timeInfo, 5000);
            if (synced) ntpSynced = true;
            
            StaticJsonDocument<256> resp;
            resp["requestId"] = requestId;
            resp["success"] = synced;
            resp["ntpSynced"] = ntpSynced;
            if (synced) {
                char timeBuf[16];
                snprintf(timeBuf, sizeof(timeBuf), "%02d:%02d:%02d", timeInfo.tm_hour, timeInfo.tm_min, timeInfo.tm_sec);
                resp["time"] = timeBuf;
                resp["hour"] = timeInfo.tm_hour;
            }
            resp["message"] = synced ? "NTP synced" : "NTP sync failed";
            char buf[256];
            serializeJson(resp, buf, sizeof(buf));
            mqtt.publish(TOPIC_RESPONSE, buf);
        }
        else if (action == "set") {
            unsigned long epoch = doc["epoch"] | 0;
            if (epoch == 0) {
                sendResponse(requestId, false, "Missing epoch");
                return;
            }
            struct timeval tv;
            tv.tv_sec = epoch;
            tv.tv_usec = 0;
            settimeofday(&tv, nullptr);
            ntpSynced = true;
            
            struct tm timeInfo;
            getLocalTime(&timeInfo, 100);
            char timeBuf[16];
            snprintf(timeBuf, sizeof(timeBuf), "%02d:%02d:%02d", timeInfo.tm_hour, timeInfo.tm_min, timeInfo.tm_sec);
            
            StaticJsonDocument<256> resp;
            resp["requestId"] = requestId;
            resp["success"] = true;
            resp["message"] = "Time set from MQTT";
            resp["time"] = timeBuf;
            resp["hour"] = timeInfo.tm_hour;
            char buf[256];
            serializeJson(resp, buf, sizeof(buf));
            mqtt.publish(TOPIC_RESPONSE, buf);
        }
        else {
            sendResponse(requestId, false, "Unknown time action");
        }
    }
    
    // ── Schedule Commands ──
    else if (topicStr == TOPIC_CMD_SCHEDULE) {
        String action = doc["action"] | "";
        
        if (action == "get") {
            StaticJsonDocument<256> resp;
            resp["requestId"] = requestId;
            resp["success"] = true;
            resp["mode"] = scheduledRestartMode;
            resp["hour"] = scheduledRestartHour;
            resp["interval"] = scheduledRestartInterval;
            char buf[256];
            serializeJson(resp, buf, sizeof(buf));
            mqtt.publish(TOPIC_RESPONSE, buf);
        }
        else if (action == "set") {
            uint8_t mode = doc["mode"] | 0;
            uint8_t hour = doc["hour"] | 0;
            uint8_t interval = doc["interval"] | 0;
            
            if (mode > 2) {
                sendResponse(requestId, false, "Invalid mode (0-2)");
                return;
            }
            
            scheduledRestartMode = mode;
            scheduledRestartHour = hour;
            scheduledRestartInterval = interval;
            nvs.putUChar(NVS_SCHED_MODE_KEY, mode);
            nvs.putUChar(NVS_SCHED_HOUR_KEY, hour);
            nvs.putUChar(NVS_SCHED_INTV_KEY, interval);
            
            StaticJsonDocument<256> resp;
            resp["requestId"] = requestId;
            resp["success"] = true;
            resp["mode"] = mode;
            resp["hour"] = hour;
            resp["interval"] = interval;
            char buf[256];
            serializeJson(resp, buf, sizeof(buf));
            mqtt.publish(TOPIC_RESPONSE, buf);
        }
        else {
            sendResponse(requestId, false, "Unknown schedule action");
        }
    }
    
    // ── OTA Commands ──
    else if (topicStr == TOPIC_CMD_OTA) {
        String action = doc["action"] | "";
        
        if (action == "begin") {
            uint32_t totalSize = doc["size"] | 0;
            String md5 = doc["md5"] | "";
            if (totalSize == 0) {
                sendResponse(requestId, false, "Missing firmware size");
                return;
            }
            bool started = otaBegin(totalSize, md5);
            if (started) {
                sendResponse(requestId, true, "OTA started, send firmware chunks");
            } else {
                sendResponse(requestId, false, "Failed to start OTA");
            }
        }
        else if (action == "abort") {
            otaAbort();
            sendResponse(requestId, true, "OTA aborted");
        }
        else {
            sendResponse(requestId, false, "Unknown OTA action");
        }
    }
}

// ============================================
// HELPER — Send simple response
// ============================================

static void sendResponse(const String& requestId, bool success, const String& message) {
    if (requestId.length() == 0) return;
    
    StaticJsonDocument<256> doc;
    doc["requestId"] = requestId;
    doc["success"] = success;
    doc["message"] = message;
    
    char buf[256];
    serializeJson(doc, buf, sizeof(buf));
    mqtt.publish(TOPIC_RESPONSE, buf);
}

// ============================================
// HELPER — Build status JSON object
// ============================================

static void buildStatusJson(JsonDocument& doc) {
    doc["doorUnlocked"] = doorUnlocked;
    doc["doorStatus"] = doorUnlocked ? "UNLOCKED" : "LOCKED";
    
    const char* stateStr;
    switch (currentState) {
        case STATE_IDLE: stateStr = "IDLE"; break;
        case STATE_AUTH_CHECK: stateStr = "AUTH_CHECK"; break;
        case STATE_PRE_UNLOCK: stateStr = "PRE_UNLOCK"; break;
        case STATE_UNLOCK: stateStr = "UNLOCK"; break;
        case STATE_REGISTRATION_MODE: stateStr = "REGISTRATION_MODE"; break;
        case STATE_CLONE_MODE: stateStr = "CLONE_MODE"; break;
        case STATE_ERROR: stateStr = "ERROR"; break;
        default: stateStr = "UNKNOWN"; break;
    }
    doc["state"] = stateStr;
    doc["lastCard"] = lastCardUID;
    doc["lastEvent"] = lastEvent;
    doc["cardCount"] = userCardCount;
    
    unsigned long uptimeMs = millis() - systemStartTime;
    doc["uptime"] = String(uptimeMs / 1000) + "s";
    doc["autoLockDuration"] = configuredAutoLockMs / 1000;
    doc["rfidDisabled"] = rfidDisabled;
    doc["rfidAutoEnableMs"] = (rfidAutoEnableTime > 0 && rfidAutoEnableTime > millis())
        ? (rfidAutoEnableTime - millis()) : 0;
    
    int hr = getCurrentHour();
    doc["ntpSynced"] = ntpSynced;
    doc["currentHour"] = hr;
    
    struct tm timeInfo;
    if (getLocalTime(&timeInfo, 100)) {
        char timeBuf[16];
        snprintf(timeBuf, sizeof(timeBuf), "%02d:%02d:%02d", timeInfo.tm_hour, timeInfo.tm_min, timeInfo.tm_sec);
        doc["currentTime"] = timeBuf;
    }
}

// ============================================
// HELPER — Parse UID string to bytes
// ============================================

static void parseUidString(const String& uidStr, byte* uidBytes, byte& uidSize) {
    // Accept "BE:02:28:DB" or "BE0228DB" format
    String clean = uidStr;
    clean.replace(":", "");
    clean.replace(" ", "");
    
    uidSize = clean.length() / 2;
    if (uidSize > UID_MAX_SIZE) uidSize = UID_MAX_SIZE;
    
    for (byte i = 0; i < uidSize; i++) {
        String byteStr = clean.substring(i * 2, i * 2 + 2);
        uidBytes[i] = (byte)strtol(byteStr.c_str(), nullptr, 16);
    }
}

// ============================================
// PUBLISH FUNCTIONS
// ============================================

void publishDoorStatus() {
    if (!mqtt.connected()) return;
    
    DynamicJsonDocument doc(1024);
    doc["type"] = "door_status";
    doc["timestamp"] = millis();
    buildStatusJson(doc);
    
    serializeJson(doc, mqttBuf, sizeof(mqttBuf));
    mqtt.publish(TOPIC_STATUS, mqttBuf, true);  // retained
}

void publishCardScan(const String& uid, bool success) {
    if (!mqtt.connected()) return;
    
    StaticJsonDocument<256> doc;
    doc["type"] = "card_scan";
    doc["timestamp"] = millis();
    doc["uid"] = uid;
    doc["success"] = success;
    
    char buf[256];
    serializeJson(doc, buf, sizeof(buf));
    mqtt.publish(TOPIC_EVENT_CARD_SCAN, buf);
}

void publishCardAdded(const String& uid) {
    if (!mqtt.connected()) return;
    
    DynamicJsonDocument doc(2048);
    doc["type"] = "card_added";
    doc["timestamp"] = millis();
    doc["uid"] = uid;
    doc["cardCount"] = userCardCount;
    
    JsonArray allCards = doc.createNestedArray("allCards");
    for (uint8_t i = 0; i < userCardCount; i++) {
        allCards.add(uidToString(userCards[i].uid, userCards[i].size));
    }
    
    serializeJson(doc, mqttBuf, sizeof(mqttBuf));
    mqtt.publish(TOPIC_EVENT_CARD_ADDED, mqttBuf);
    publishDoorStatus();
}

void publishCardRemoved(const String& uid) {
    if (!mqtt.connected()) return;
    
    DynamicJsonDocument doc(2048);
    doc["type"] = "card_removed";
    doc["timestamp"] = millis();
    doc["uid"] = uid;
    doc["cardCount"] = userCardCount;
    
    JsonArray allCards = doc.createNestedArray("allCards");
    for (uint8_t i = 0; i < userCardCount; i++) {
        allCards.add(uidToString(userCards[i].uid, userCards[i].size));
    }
    
    serializeJson(doc, mqttBuf, sizeof(mqttBuf));
    mqtt.publish(TOPIC_EVENT_CARD_REMOVED, mqttBuf);
    publishDoorStatus();
}

void publishRegistrationMode(bool active) {
    if (!mqtt.connected()) return;
    
    StaticJsonDocument<128> doc;
    doc["type"] = "registration_mode";
    doc["timestamp"] = millis();
    doc["active"] = active;
    
    char buf[128];
    serializeJson(doc, buf, sizeof(buf));
    mqtt.publish(TOPIC_EVENT_REGISTRATION, buf);
}

void publishCloneStatus(const String& step, const String& sourceUID, const String& result) {
    if (!mqtt.connected()) return;
    
    StaticJsonDocument<256> doc;
    doc["type"] = "clone_status";
    doc["timestamp"] = millis();
    doc["state"] = (currentState == STATE_CLONE_MODE) ? "CLONE_MODE" : "IDLE";
    doc["step"] = step;
    if (sourceUID.length() > 0) doc["sourceUID"] = sourceUID;
    if (result.length() > 0) doc["result"] = result;
    
    char buf[256];
    serializeJson(doc, buf, sizeof(buf));
    mqtt.publish(TOPIC_EVENT_CLONE, buf);
}

void publishSystemInfo() {
    if (!mqtt.connected()) return;
    
    DynamicJsonDocument doc(512);
    doc["type"] = "system_info";
    doc["timestamp"] = millis();
    doc["ip"] = WiFi.localIP().toString();
    doc["rssi"] = WiFi.RSSI();
    doc["uptime"] = String((millis() - systemStartTime) / 1000) + "s";
    doc["firmwareVersion"] = "2.0.0-mqtt";
    doc["freeHeap"] = ESP.getFreeHeap();
    doc["totalHeap"] = ESP.getHeapSize();
    
    const esp_partition_t* partition = esp_ota_get_running_partition();
    if (partition) {
        doc["partitionSize"] = partition->size;
    }
    doc["usedFlash"] = ESP.getSketchSize();
    doc["totalFlash"] = ESP.getFlashChipSize();
    
    // Temperature (if available)
    float temp = temperatureRead();
    if (temp > 0 && temp < 150) doc["temperature"] = temp;
    
    serializeJson(doc, mqttBuf, sizeof(mqttBuf));
    mqtt.publish(TOPIC_SYSTEM_INFO, mqttBuf, true);  // retained
}

void publishAccessLog(const String& uid, const String& action, bool success, const String& accessType) {
    if (!mqtt.connected()) return;
    
    StaticJsonDocument<256> doc;
    doc["type"] = "access_log";
    doc["timestamp"] = millis();
    doc["cardUid"] = uid;
    doc["action"] = action;
    doc["success"] = success;
    doc["accessType"] = accessType;
    
    // Add ISO timestamp if NTP is synced
    struct tm timeInfo;
    if (getLocalTime(&timeInfo, 100)) {
        char isoBuf[32];
        strftime(isoBuf, sizeof(isoBuf), "%Y-%m-%dT%H:%M:%S", &timeInfo);
        doc["isoTimestamp"] = String(isoBuf) + "+07:00";
    }
    
    char buf[256];
    serializeJson(doc, buf, sizeof(buf));
    mqtt.publish(TOPIC_EVENT_ACCESS_LOG, buf);
}

// ============================================
// NVS CONFIG HELPERS
// ============================================

void saveAutoLockToNVS(uint16_t seconds) {
    nvs.putUShort(NVS_AUTOLOCK_KEY, seconds);
    configuredAutoLockMs = (unsigned long)seconds * 1000;
    DEBUG_PRINTF("[Config] Auto-lock saved: %us (%lums)\n", seconds, configuredAutoLockMs);
}

void saveCardDelayToNVS(const String& uidHex, uint16_t seconds) {
    String key = "d" + uidHex;
    if (seconds == 0) {
        nvs.remove(key.c_str());
    } else {
        nvs.putUShort(key.c_str(), seconds);
    }
    DEBUG_PRINTF("[Config] Card delay for %s: %us\n", uidHex.c_str(), seconds);
}

void saveCardScheduleToNVS(const String& uidHex, uint8_t startHour, uint8_t endHour, uint8_t delaySec) {
    String key = "s" + uidHex;
    uint8_t data[3] = {startHour, endHour, delaySec};
    nvs.putBytes(key.c_str(), data, 3);
    DEBUG_PRINTF("[Config] Schedule for %s: %d-%d = %ds\n", uidHex.c_str(), startHour, endHour, delaySec);
}

void removeCardScheduleFromNVS(const String& uidHex) {
    String key = "s" + uidHex;
    nvs.remove(key.c_str());
    DEBUG_PRINTF("[Config] Schedule removed for %s\n", uidHex.c_str());
}

// ============================================
// MQTT CONNECT
// ============================================

static bool mqttConnect() {
    DEBUG_PRINTLN("[MQTT] Connecting to broker...");
    DEBUG_PRINTF("[MQTT] Server: %s:%d\n", MQTT_SERVER, MQTT_PORT);
    
    // Set Last Will — publish "offline" to availability topic
    bool connected = mqtt.connect(
        MQTT_CLIENT_ID,
        MQTT_USERNAME,
        MQTT_PASSWORD,
        TOPIC_AVAILABILITY,  // LWT topic
        1,                   // LWT QoS
        true,                // LWT retained
        "offline"            // LWT message
    );
    
    if (connected) {
        DEBUG_PRINTLN("[MQTT] Connected!");
        
        // Publish online status (retained)
        mqtt.publish(TOPIC_AVAILABILITY, "online", true);
        
        // Subscribe to command topics
        mqtt.subscribe(TOPIC_CMD_DOOR, 1);
        mqtt.subscribe(TOPIC_CMD_CARDS, 1);
        mqtt.subscribe(TOPIC_CMD_CONFIG, 1);
        mqtt.subscribe(TOPIC_CMD_MODE, 1);
        mqtt.subscribe(TOPIC_CMD_RFID, 1);
        mqtt.subscribe(TOPIC_CMD_SYSTEM, 1);
        mqtt.subscribe(TOPIC_CMD_TIME, 1);
        mqtt.subscribe(TOPIC_CMD_SCHEDULE, 1);
        mqtt.subscribe(TOPIC_CMD_OTA, 1);
        mqtt.subscribe(TOPIC_OTA_DATA, 1);
        
        DEBUG_PRINTLN("[MQTT] Subscribed to command topics");
        
        // Publish initial status
        publishDoorStatus();
        publishSystemInfo();
        
        lastEvent = "MQTT connected";
    } else {
        DEBUG_PRINTF("[MQTT] Connection failed, rc=%d\n", mqtt.state());
    }
    
    return connected;
}

// ============================================
// SETUP
// ============================================

void setupMQTT() {
    DEBUG_PRINTLN("\n[MQTT] Setting up MQTT...");
    
    #if MQTT_USE_TLS
    espClient.setInsecure();  // Accept any certificate (for testing)
    // For production, set CA certificate:
    // espClient.setCACert(mqtt_ca_cert);
    DEBUG_PRINTLN("[MQTT] TLS enabled (insecure mode)");
    #endif
    
    mqtt.setServer(MQTT_SERVER, MQTT_PORT);
    mqtt.setCallback(mqttCallback);
    mqtt.setBufferSize(MQTT_BUFFER_SIZE);
    mqtt.setKeepAlive(MQTT_KEEPALIVE);
    
    DEBUG_PRINTF("[MQTT] Buffer size: %d bytes\n", MQTT_BUFFER_SIZE);
    DEBUG_PRINTF("[MQTT] Keep-alive: %ds\n", MQTT_KEEPALIVE);
    
    // Initial connection
    if (wifiConnected) {
        mqttConnect();
    }
}

// ============================================
// LOOP — call from main loop()
// ============================================

void mqttLoop() {
    if (!wifiConnected) return;
    
    if (!mqtt.connected()) {
        unsigned long now = millis();
        if (now - lastReconnectAttempt >= MQTT_RECONNECT_INTERVAL) {
            lastReconnectAttempt = now;
            mqttConnect();
        }
        return;
    }
    
    // Process incoming MQTT messages
    mqtt.loop();
    
    // Periodic status publish
    unsigned long now = millis();
    if (now - lastStatusPublish >= STATUS_PUBLISH_INTERVAL) {
        lastStatusPublish = now;
        publishDoorStatus();
    }
    
    // Periodic system info publish
    if (now - lastSystemInfoPublish >= SYSTEM_INFO_INTERVAL) {
        lastSystemInfoPublish = now;
        publishSystemInfo();
    }
}

bool isMqttConnected() {
    return mqtt.connected();
}

void handleMQTTTasks() {
    mqttLoop();
}
