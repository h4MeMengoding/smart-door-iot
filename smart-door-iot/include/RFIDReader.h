#ifndef RFID_READER_H
#define RFID_READER_H

#include <Arduino.h>

// ============================================
// RFID HANDLER
// ============================================

bool initRFID();
bool readCard(byte* uid, byte* size);
bool isNewCardScan(byte* uid, byte size);

#endif // RFID_READER_H
