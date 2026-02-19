#ifndef OTA_UPDATE_H
#define OTA_UPDATE_H

#include <Arduino.h>
#include <Update.h>

// ============================================
// MQTT OTA UPDATE
// ============================================

extern bool mqttOtaInProgress;
extern uint32_t otaTotalSize;
extern uint32_t otaReceivedBytes;
extern String otaExpectedMd5;

// Begin OTA update — call when receiving OTA begin command
// Returns true if Update.begin() succeeds
bool otaBegin(uint32_t totalSize, const String& md5);

// Write a chunk of firmware data
// Called from MQTT callback when data arrives on ota/data topic
void otaWriteChunk(uint8_t* data, size_t length);

// Abort current OTA
void otaAbort();

// Publish OTA progress via MQTT
void publishOtaProgress(uint8_t percent, const String& status);

#endif // OTA_UPDATE_H
