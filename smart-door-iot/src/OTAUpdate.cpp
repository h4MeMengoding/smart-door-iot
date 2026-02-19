#include "OTAUpdate.h"
#include "GlobalState.h"
#include "DoorController.h"
#include "config.h"
#include <ArduinoJson.h>
#include <PubSubClient.h>

// Reference to external MQTT client (defined in MQTTHandler.cpp)
extern PubSubClient mqtt;

// OTA state
bool mqttOtaInProgress = false;
uint32_t otaTotalSize = 0;
uint32_t otaReceivedBytes = 0;
String otaExpectedMd5 = "";

static unsigned long otaStartTime = 0;
static unsigned long lastProgressPublish = 0;
static uint32_t lastProgressBytes = 0;

#define OTA_PROGRESS_INTERVAL  1000  // Publish progress every 1 second
#define OTA_TIMEOUT            300000 // 5 minute timeout for OTA

// ============================================
// OTA BEGIN
// ============================================

bool otaBegin(uint32_t totalSize, const String& md5) {
    if (mqttOtaInProgress) {
        DEBUG_PRINTLN("[OTA-MQTT] Already in progress, aborting previous");
        Update.abort();
    }
    
    DEBUG_PRINTF("[OTA-MQTT] Starting OTA update: %u bytes\n", totalSize);
    
    // Lock the door for safety during OTA
    lockDoor();
    currentState = STATE_IDLE;
    
    otaTotalSize = totalSize;
    otaReceivedBytes = 0;
    otaExpectedMd5 = md5;
    
    if (!Update.begin(totalSize, U_FLASH)) {
        DEBUG_PRINTF("[OTA-MQTT] Update.begin() failed: %s\n", Update.errorString());
        publishOtaProgress(0, "error: " + String(Update.errorString()));
        mqttOtaInProgress = false;
        return false;
    }
    
    if (md5.length() > 0) {
        Update.setMD5(md5.c_str());
        DEBUG_PRINTF("[OTA-MQTT] MD5 set: %s\n", md5.c_str());
    }
    
    mqttOtaInProgress = true;
    otaInProgress = true;  // Set global OTA flag to skip other loop logic
    otaStartTime = millis();
    lastProgressPublish = 0;
    lastProgressBytes = 0;
    
    publishOtaProgress(0, "started");
    lastEvent = "MQTT OTA update started";
    DEBUG_PRINTLN("[OTA-MQTT] Ready to receive firmware chunks");
    
    return true;
}

// ============================================
// OTA WRITE CHUNK
// ============================================

void otaWriteChunk(uint8_t* data, size_t length) {
    if (!mqttOtaInProgress) return;
    
    // Check timeout
    if (millis() - otaStartTime > OTA_TIMEOUT) {
        DEBUG_PRINTLN("[OTA-MQTT] Timeout! Aborting...");
        otaAbort();
        publishOtaProgress(0, "error: timeout");
        return;
    }
    
    // Write chunk to flash
    size_t written = Update.write(data, length);
    if (written != length) {
        DEBUG_PRINTF("[OTA-MQTT] Write error: wrote %d of %d bytes\n", written, length);
        otaAbort();
        publishOtaProgress(0, "error: write failed");
        return;
    }
    
    otaReceivedBytes += written;
    
    // Calculate progress
    uint8_t percent = (uint8_t)((otaReceivedBytes * 100) / otaTotalSize);
    
    // Publish progress periodically (not every chunk — too much overhead)
    unsigned long now = millis();
    if (now - lastProgressPublish >= OTA_PROGRESS_INTERVAL || percent == 100) {
        lastProgressPublish = now;
        
        // Calculate speed
        float elapsedSec = (now - otaStartTime) / 1000.0;
        float speedKBps = elapsedSec > 0 ? (otaReceivedBytes / 1024.0) / elapsedSec : 0;
        
        DEBUG_PRINTF("[OTA-MQTT] Progress: %d%% (%u/%u bytes, %.1f KB/s)\n", 
                     percent, otaReceivedBytes, otaTotalSize, speedKBps);
        
        String status = "uploading";
        if (percent >= 100) status = "verifying";
        publishOtaProgress(percent, status);
    }
    
    // Check if finished
    if (otaReceivedBytes >= otaTotalSize) {
        DEBUG_PRINTLN("[OTA-MQTT] All bytes received, finalizing...");
        
        if (Update.end(true)) {
            DEBUG_PRINTLN("[OTA-MQTT] Update SUCCESS! Restarting...");
            publishOtaProgress(100, "success");
            lastEvent = "MQTT OTA complete, restarting";
            
            // Give MQTT time to send the final message
            mqtt.loop();
            delay(1000);
            
            ESP.restart();
        } else {
            DEBUG_PRINTF("[OTA-MQTT] Update.end() failed: %s\n", Update.errorString());
            publishOtaProgress(0, "error: " + String(Update.errorString()));
            mqttOtaInProgress = false;
            otaInProgress = false;
        }
    }
}

// ============================================
// OTA ABORT
// ============================================

void otaAbort() {
    if (mqttOtaInProgress) {
        Update.abort();
        mqttOtaInProgress = false;
        otaInProgress = false;
        otaReceivedBytes = 0;
        otaTotalSize = 0;
        DEBUG_PRINTLN("[OTA-MQTT] OTA aborted");
        lastEvent = "MQTT OTA aborted";
        publishOtaProgress(0, "aborted");
    }
}

// ============================================
// PUBLISH OTA PROGRESS
// ============================================

void publishOtaProgress(uint8_t percent, const String& status) {
    if (!mqtt.connected()) return;
    
    StaticJsonDocument<256> doc;
    doc["percent"] = percent;
    doc["received"] = otaReceivedBytes;
    doc["total"] = otaTotalSize;
    doc["status"] = status;
    
    char buf[256];
    serializeJson(doc, buf, sizeof(buf));
    mqtt.publish("smartdoor/ota/progress", buf);
}
