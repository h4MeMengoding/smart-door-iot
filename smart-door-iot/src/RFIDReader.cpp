#include "RFIDReader.h"
#include "GlobalState.h"
#include "BuzzerController.h"
#include "CardManager.h"
#include <SPI.h>

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
    // Check for new card (non-blocking)
    if (!rfid.PICC_IsNewCardPresent()) {
        return false;
    }
    
    // Read card serial
    if (!rfid.PICC_ReadCardSerial()) {
        return false;
    }
    
    *size = rfid.uid.size;
    for (byte i = 0; i < *size; i++) {
        uid[i] = rfid.uid.uidByte[i];
    }
    
    // CRITICAL: Halt PICC dan stop crypto untuk free SPI bus
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
