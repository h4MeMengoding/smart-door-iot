#ifndef CARD_MANAGER_H
#define CARD_MANAGER_H

#include <Arduino.h>
#include <ArduinoJson.h>
#include "config.h"

// ============================================
// UID HELPER FUNCTIONS
// ============================================

bool compareUID(byte* uid1, byte size1, byte* uid2, byte size2);
String uidToString(byte* uid, byte size);

// ============================================
// NVS - NON-VOLATILE STORAGE
// ============================================

void initNVS();
void loadCardsFromNVS();
bool addCardToNVS(byte* uid, byte size);
bool removeCardFromNVS(byte* uid, byte size);
void clearAllUserCards();
void syncCardsFromList(JsonArray& uidList);
bool isCardRegistered(byte* uid, byte size);
bool isMasterCard(byte* uid, byte size);

#endif // CARD_MANAGER_H
