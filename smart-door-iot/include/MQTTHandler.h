#ifndef MQTT_HANDLER_H
#define MQTT_HANDLER_H

#include <Arduino.h>

// Override PubSubClient keepalive before including it
#ifdef MQTT_KEEPALIVE
#undef MQTT_KEEPALIVE
#endif
#define MQTT_KEEPALIVE 60

#include <PubSubClient.h>
#include <WiFiClientSecure.h>
#include <ArduinoJson.h>

// ============================================
// MQTT TOPICS
// ============================================

// ESP32 → Server/Dashboard (publish)
#define TOPIC_STATUS            "smartdoor/status"          // Retained — full door status
#define TOPIC_AVAILABILITY      "smartdoor/availability"    // Retained — "online" / "offline"
#define TOPIC_EVENT_CARD_SCAN   "smartdoor/event/card_scan"
#define TOPIC_EVENT_CARD_ADDED  "smartdoor/event/card_added"
#define TOPIC_EVENT_CARD_REMOVED "smartdoor/event/card_removed"
#define TOPIC_EVENT_REGISTRATION "smartdoor/event/registration"
#define TOPIC_EVENT_CLONE       "smartdoor/event/clone"
#define TOPIC_EVENT_ACCESS_LOG  "smartdoor/event/access_log"
#define TOPIC_SYSTEM_INFO       "smartdoor/system/info"     // Retained
#define TOPIC_RESPONSE          "smartdoor/response"        // Command responses
#define TOPIC_OTA_PROGRESS      "smartdoor/ota/progress"    // OTA progress

// Server/Dashboard → ESP32 (subscribe)
#define TOPIC_CMD_DOOR          "smartdoor/cmd/door"
#define TOPIC_CMD_CARDS         "smartdoor/cmd/cards"
#define TOPIC_CMD_CONFIG        "smartdoor/cmd/config"
#define TOPIC_CMD_MODE          "smartdoor/cmd/mode"
#define TOPIC_CMD_RFID          "smartdoor/cmd/rfid"
#define TOPIC_CMD_TOUCH         "smartdoor/cmd/touch"
#define TOPIC_CMD_SYSTEM        "smartdoor/cmd/system"
#define TOPIC_CMD_TIME          "smartdoor/cmd/time"
#define TOPIC_CMD_SCHEDULE      "smartdoor/cmd/schedule"
#define TOPIC_CMD_OTA           "smartdoor/cmd/ota"
#define TOPIC_OTA_DATA          "smartdoor/ota/data"

// ============================================
// MQTT FUNCTIONS
// ============================================

// Setup & connection
void setupMQTT();
void mqttLoop();
bool isMqttConnected();

// Publishing — status & events
void publishDoorStatus();
void publishCardScan(const String& uid, bool success);
void publishCardAdded(const String& uid);
void publishCardRemoved(const String& uid);
void publishRegistrationMode(bool active);
void publishCloneStatus(const String& step, const String& sourceUID = "", const String& result = "");
void publishSystemInfo();
void publishAccessLog(const String& uid, const String& action, bool success, const String& accessType);

// Legacy aliases for compatibility with StateMachine.cpp
#define broadcastDoorStatus()  publishDoorStatus()
#define broadcastCardScan(uid, success)  publishCardScan(uid, success)
#define broadcastCardAdded(uid)  publishCardAdded(uid)
#define broadcastCardRemoved(uid)  publishCardRemoved(uid)
#define broadcastRegistrationMode(active)  publishRegistrationMode(active)
#define broadcastCloneStatus(step, ...)  publishCloneStatus(step, ##__VA_ARGS__)

// Config NVS helpers (same as APIHandler had)
void saveAutoLockToNVS(uint16_t seconds);
void saveCardDelayToNVS(const String& uidHex, uint16_t seconds);
void saveCardScheduleToNVS(const String& uidHex, uint8_t slot, uint8_t startHour, uint8_t endHour, uint8_t delaySec);
void removeCardScheduleFromNVS(const String& uidHex, int8_t slot = -1);
void saveCardDelayEnabled(const String& uidHex, bool enabled);

// Handle MQTT tasks (call from loop)
void handleMQTTTasks();

#endif // MQTT_HANDLER_H
