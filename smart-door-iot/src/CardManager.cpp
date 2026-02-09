#include "CardManager.h"
#include "GlobalState.h"

// ============================================
// UID HELPER FUNCTIONS
// ============================================

bool compareUID(byte* uid1, byte size1, byte* uid2, byte size2) {
    if (size1 != size2) return false;
    for (byte i = 0; i < size1; i++) {
        if (uid1[i] != uid2[i]) return false;
    }
    return true;
}

String uidToString(byte* uid, byte size) {
    String str = "";
    for (byte i = 0; i < size; i++) {
        if (i > 0) str += ":";
        if (uid[i] < 0x10) str += "0";
        str += String(uid[i], HEX);
    }
    str.toUpperCase();
    return str;
}

// ============================================
// NVS - NON-VOLATILE STORAGE
// ============================================

void initNVS() {
    DEBUG_PRINTLN("\n[NVS] Initializing NVS...");
    if (!nvs.begin(NVS_NAMESPACE, false)) {
        DEBUG_PRINTLN("[NVS] ERROR: Failed to initialize NVS!");
        return;
    }
    DEBUG_PRINTLN("[NVS] NVS initialized successfully");
}

void loadCardsFromNVS() {
    DEBUG_PRINTLN("[NVS] Loading registered cards...");
    
    userCardCount = nvs.getUChar(NVS_USER_COUNT_KEY, 0);
    DEBUG_PRINTF("[NVS] User card count: %d\n", userCardCount);
    
    if (userCardCount > MAX_USER_CARDS) {
        DEBUG_PRINTLN("[NVS] WARNING: Card count exceeds maximum, resetting");
        userCardCount = 0;
        nvs.putUChar(NVS_USER_COUNT_KEY, 0);
        return;
    }
    
    for (uint8_t i = 0; i < userCardCount; i++) {
        String key = NVS_USER_KEY_PREFIX + String(i);
        size_t len = nvs.getBytesLength(key.c_str());
        
        if (len > 0 && len <= (UID_MAX_SIZE + 1)) {
            byte data[UID_MAX_SIZE + 1];
            nvs.getBytes(key.c_str(), data, len);
            
            userCards[i].size = data[0];
            for (byte j = 0; j < data[0]; j++) {
                userCards[i].uid[j] = data[j + 1];
            }
            
            DEBUG_PRINTF("[NVS] Card %d: %s\n", i, uidToString(userCards[i].uid, userCards[i].size).c_str());
        }
    }
    
    DEBUG_PRINTF("[NVS] Loaded %d cards successfully\n", userCardCount);
}

bool addCardToNVS(byte* uid, byte size) {
    if (userCardCount >= MAX_USER_CARDS) {
        DEBUG_PRINTLN("[NVS] ERROR: Card storage full!");
        return false;
    }
    
    // Store in RAM
    userCards[userCardCount].size = size;
    for (byte i = 0; i < size; i++) {
        userCards[userCardCount].uid[i] = uid[i];
    }
    
    // Store in NVS
    String key = NVS_USER_KEY_PREFIX + String(userCardCount);
    byte data[UID_MAX_SIZE + 1];
    data[0] = size;
    for (byte i = 0; i < size; i++) {
        data[i + 1] = uid[i];
    }
    
    if (nvs.putBytes(key.c_str(), data, size + 1) == 0) {
        DEBUG_PRINTLN("[NVS] ERROR: Failed to write card to NVS");
        return false;
    }
    
    userCardCount++;
    nvs.putUChar(NVS_USER_COUNT_KEY, userCardCount);
    
    DEBUG_PRINTF("[NVS] Card added: %s (Total: %d)\n", uidToString(uid, size).c_str(), userCardCount);
    
    return true;
}

bool removeCardFromNVS(byte* uid, byte size) {
    // Find card index
    int cardIndex = -1;
    for (uint8_t i = 0; i < userCardCount; i++) {
        if (compareUID(userCards[i].uid, userCards[i].size, uid, size)) {
            cardIndex = i;
            break;
        }
    }
    
    if (cardIndex == -1) {
        DEBUG_PRINTLN("[NVS] Card not found in storage");
        return false;
    }
    
    DEBUG_PRINTF("[NVS] Removing card at index %d: %s\n", cardIndex, uidToString(uid, size).c_str());
    
    // Shift remaining cards down
    for (uint8_t i = cardIndex; i < userCardCount - 1; i++) {
        userCards[i] = userCards[i + 1];
        
        // Update NVS
        String key = NVS_USER_KEY_PREFIX + String(i);
        byte data[UID_MAX_SIZE + 1];
        data[0] = userCards[i].size;
        for (byte j = 0; j < userCards[i].size; j++) {
            data[j + 1] = userCards[i].uid[j];
        }
        nvs.putBytes(key.c_str(), data, userCards[i].size + 1);
    }
    
    // Remove last card entry
    userCardCount--;
    String lastKey = NVS_USER_KEY_PREFIX + String(userCardCount);
    nvs.remove(lastKey.c_str());
    nvs.putUChar(NVS_USER_COUNT_KEY, userCardCount);
    
    DEBUG_PRINTF("[NVS] Card removed successfully (Remaining: %d)\n", userCardCount);
    
    return true;
}

bool isCardRegistered(byte* uid, byte size) {
    for (uint8_t i = 0; i < userCardCount; i++) {
        if (compareUID(userCards[i].uid, userCards[i].size, uid, size)) {
            return true;
        }
    }
    return false;
}

bool isMasterCard(byte* uid, byte size) {
    for (uint8_t i = 0; i < MAX_MASTER_CARDS; i++) {
        if (MASTER_CARDS[i][0] == size) {
            bool match = true;
            for (byte j = 0; j < size; j++) {
                if (MASTER_CARDS[i][j + 1] != uid[j]) {
                    match = false;
                    break;
                }
            }
            if (match) return true;
        }
    }
    return false;
}

// ============================================
// SYNC: Clear all user cards from NVS + RAM
// ============================================

void clearAllUserCards() {
    DEBUG_PRINTLN("[NVS] Clearing all user cards...");
    for (uint8_t i = 0; i < userCardCount; i++) {
        String key = NVS_USER_KEY_PREFIX + String(i);
        nvs.remove(key.c_str());
    }
    userCardCount = 0;
    nvs.putUChar(NVS_USER_COUNT_KEY, 0);
    DEBUG_PRINTLN("[NVS] All user cards cleared");
}

// ============================================
// SYNC: Replace NVS cards with list from server
// ============================================

void syncCardsFromList(JsonArray& uidList) {
    DEBUG_PRINTF("[SYNC] Syncing %d cards from server...\n", uidList.size());
    
    // Clear existing
    clearAllUserCards();
    
    // Add each card from server list
    for (JsonVariant v : uidList) {
        String uidStr = v.as<String>();
        uidStr.toUpperCase();
        uidStr.replace(":", "");
        
        // Convert hex string to byte array
        byte uid[7];
        uint8_t uidSize = 0;
        for (size_t i = 0; i < uidStr.length() && i < 14; i += 2) {
            String byteStr = uidStr.substring(i, i + 2);
            uid[uidSize++] = (byte)strtol(byteStr.c_str(), NULL, 16);
        }
        
        if (uidSize > 0 && !isMasterCard(uid, uidSize)) {
            addCardToNVS(uid, uidSize);
        }
    }
    
    DEBUG_PRINTF("[SYNC] Sync complete. %d cards in NVS\n", userCardCount);
}
