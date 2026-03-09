#include "RFIDReader.h"
#include "GlobalState.h"
#include "BuzzerController.h"
#include "CardManager.h"
#include <SPI.h>

// Periodic antenna reinit to prevent MFRC522 stuck states
static unsigned long lastAntennaReinit = 0;
#define ANTENNA_REINIT_INTERVAL 5000  // Re-init antenna every 5 seconds

// ============================================
// RFID HANDLER
// ============================================

bool initRFID() {
    DEBUG_PRINTLN("\n[RFID] Initializing MFRC522...");
    
    SPI.begin(RFID_SCK_PIN, RFID_MISO_PIN, RFID_MOSI_PIN, RFID_SDA_PIN);
    rfid.PCD_Init();
    delay(100);  // Keep minimal delay untuk RFID hardware init
    
    // Check if RFID is connected
    byte version = rfid.PCD_ReadRegister(rfid.VersionReg);
    
    if (version == 0x00 || version == 0xFF) {
        DEBUG_PRINTLN("[RFID] ERROR: MFRC522 not detected!");
        DEBUG_PRINTLN("[RFID] Check wiring: SDA=5, RST=4, 3.3V power");
        Serial.flush();  // Flush serial sebelum error
        playBuzzerPattern(PATTERN_INIT_FAIL);
        return false;
    }
    
    DEBUG_PRINTF("[RFID] MFRC522 version: 0x%02X\n", version);
    DEBUG_PRINTLN("[RFID] RFID reader initialized successfully!");
    Serial.flush();  // Flush after init log
    
    playBuzzerPattern(PATTERN_INIT_OK);
    
    // Blink LED non-blocking
    for (int i = 0; i < 2; i++) {
        digitalWrite(LED_PIN, HIGH);
        delay(50);  // Reduced dari 100ms
        digitalWrite(LED_PIN, LOW);
        delay(50);
    }
    
    return true;
}

bool readCard(byte* uid, byte* size) {
    // Periodic antenna reinit to recover from stuck MFRC522 states
    // (SPI interference, failed reads, etc. can cause module to stop detecting cards)
    unsigned long now = millis();
    if (now - lastAntennaReinit >= ANTENNA_REINIT_INTERVAL) {
        lastAntennaReinit = now;
        rfid.PCD_Init();
    }

    // Use WUPA instead of REQA to detect cards in BOTH Idle and Halt states.
    // PICC_IsNewCardPresent() sends REQA which ONLY wakes Idle cards.
    // Some cards get stuck in Halt state after PCD_Init() resets the reader
    // while the card is still in the RF field — the card never transitions
    // back to Idle and becomes permanently invisible to REQA.
    // WUPA fixes this. Our isNewCardScan() cooldown prevents repeat detection.
    byte bufferATQA[2];
    byte bufferSize = sizeof(bufferATQA);
    MFRC522::StatusCode status = rfid.PICC_WakeupA(bufferATQA, &bufferSize);
    if (status != MFRC522::STATUS_OK && status != MFRC522::STATUS_COLLISION) {
        return false;
    }
    
    // Read card serial (anticollision + select)
    if (!rfid.PICC_ReadCardSerial()) {
        // Card responded to WUPA but anticollision/SELECT failed.
        // Halt it so it doesn't block subsequent detections.
        rfid.PICC_HaltA();
        rfid.PCD_StopCrypto1();
        return false;
    }
    
    *size = rfid.uid.size;
    for (byte i = 0; i < *size; i++) {
        uid[i] = rfid.uid.uidByte[i];
    }
    
    // Halt PICC and stop crypto to free SPI bus
    rfid.PICC_HaltA();
    rfid.PCD_StopCrypto1();
    
    return true;
}

bool isNewCardScan(byte* uid, byte size) {
    // Jika lastScanTime = 0, berarti fresh state (setelah lock atau boot)
    // Langsung terima kartu apapun
    if (lastScanTime == 0) {
        // Update last scan
        lastScannedSize = size;
        for (byte i = 0; i < size; i++) {
            lastScannedUID[i] = uid[i];
        }
        lastScanTime = millis();
        return true;
    }
    
    // Check if same card scanned within cooldown period
    if (millis() - lastScanTime < RFID_COOLDOWN_TIME) {
        if (compareUID(uid, size, lastScannedUID, lastScannedSize)) {
            return false; // Same card, too soon
        }
    }
    
    // Update last scan
    lastScannedSize = size;
    for (byte i = 0; i < size; i++) {
        lastScannedUID[i] = uid[i];
    }
    lastScanTime = millis();
    
    return true;
}
