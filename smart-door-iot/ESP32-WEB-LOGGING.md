# Contoh Kode ESP32 untuk Mengirim Log ke Web Server

## Di file config.h, tambahkan:

```cpp
// ============================================
// 🌐 WEB SERVER LOGGING CONFIGURATION
// ============================================

#define WEB_SERVER_ENABLED  true                    // Enable logging to web server
#define WEB_SERVER_IP       "10.10.1.100"          // IP komputer yang menjalankan Next.js
#define WEB_SERVER_PORT     3000                    // Port Next.js (default: 3000)
#define WEB_API_KEY         "Ayamgeprek102938"     // Sama dengan ESP32_API_KEY di .env.local
#define WEB_LOG_ENDPOINT    "/api/logs"
#define WEB_CARD_ENDPOINT   "/api/cards"
```

## Di file APIHandler.h, tambahkan:

```cpp
class APIHandler {
public:
    // ... existing methods ...
    
    // Web Server Logging
    static bool sendLogToWebServer(const char* cardUid, const char* cardNickname, 
                                   const char* action, bool success);
    static bool sendCardToWebServer(const char* cardUid, const char* cardNickname);
};
```

## Di file APIHandler.cpp, tambahkan:

```cpp
#include <HTTPClient.h>

bool APIHandler::sendLogToWebServer(const char* cardUid, const char* cardNickname, 
                                    const char* action, bool success) {
    #if !WEB_SERVER_ENABLED
        return false;
    #endif
    
    HTTPClient http;
    String url = String("http://") + WEB_SERVER_IP + ":" + 
                 String(WEB_SERVER_PORT) + WEB_LOG_ENDPOINT;
    
    DEBUG_PRINTF("[API] Sending log to: %s\n", url.c_str());
    
    http.begin(url);
    http.addHeader("Content-Type", "application/json");
    http.addHeader("X-API-Key", WEB_API_KEY);
    http.setTimeout(5000); // 5 second timeout
    
    // Build JSON payload
    String payload = "{";
    payload += "\"cardUid\":\"" + String(cardUid) + "\"";
    
    if (cardNickname && strlen(cardNickname) > 0) {
        payload += ",\"cardNickname\":\"" + String(cardNickname) + "\"";
    }
    
    payload += ",\"action\":\"" + String(action) + "\"";
    payload += ",\"success\":" + String(success ? "true" : "false");
    payload += "}";
    
    DEBUG_PRINTF("[API] Payload: %s\n", payload.c_str());
    
    int httpCode = http.POST(payload);
    
    if (httpCode > 0) {
        DEBUG_PRINTF("[API] Response code: %d\n", httpCode);
        
        if (httpCode == 200) {
            String response = http.getString();
            DEBUG_PRINTF("[API] Response: %s\n", response.c_str());
            http.end();
            return true;
        }
    } else {
        DEBUG_PRINTF("[API] Error: %s\n", http.errorToString(httpCode).c_str());
    }
    
    http.end();
    return false;
}

bool APIHandler::sendCardToWebServer(const char* cardUid, const char* cardNickname) {
    #if !WEB_SERVER_ENABLED
        return false;
    #endif
    
    HTTPClient http;
    String url = String("http://") + WEB_SERVER_IP + ":" + 
                 String(WEB_SERVER_PORT) + WEB_CARD_ENDPOINT;
    
    DEBUG_PRINTF("[API] Registering card to: %s\n", url.c_str());
    
    http.begin(url);
    http.addHeader("Content-Type", "application/json");
    http.addHeader("X-API-Key", WEB_API_KEY);
    http.setTimeout(5000);
    
    String payload = "{\"uid\":\"" + String(cardUid) + "\"";
    
    if (cardNickname && strlen(cardNickname) > 0) {
        payload += ",\"nickname\":\"" + String(cardNickname) + "\"";
    }
    
    payload += "}";
    
    int httpCode = http.POST(payload);
    
    if (httpCode > 0) {
        DEBUG_PRINTF("[API] Card registration code: %d\n", httpCode);
        http.end();
        return (httpCode == 200);
    }
    
    http.end();
    return false;
}
```

## Di file StateMachine.cpp, panggil fungsi ini:

### Saat kartu valid (unlock):
```cpp
case STATE_AUTH_CHECK:
    if (validCard) {
        // ... existing code ...
        door.unlock();
        led.setPattern(LED_PATTERN_UNLOCK_SUCCESS);
        buzzer.playPattern(PATTERN_VALID_CARD);
        
        // Send log to web server
        APIHandler::sendLogToWebServer(
            cardManager.getLastCardUid(), 
            cardManager.getCardNickname(),
            "unlock", 
            true
        );
        
        currentState = STATE_UNLOCK;
    }
    break;
```

### Saat kartu ditolak:
```cpp
case STATE_AUTH_CHECK:
    if (!validCard) {
        // ... existing code ...
        buzzer.playPattern(PATTERN_INVALID_CARD);
        led.setPattern(LED_PATTERN_UNLOCK_FAIL);
        
        // Send log to web server
        APIHandler::sendLogToWebServer(
            cardManager.getLastCardUid(), 
            nullptr,
            "denied", 
            false
        );
        
        currentState = STATE_IDLE;
    }
    break;
```

### Saat kartu baru didaftarkan:
```cpp
case STATE_REGISTRATION_MODE:
    if (cardScanned && isMasterCard) {
        // ... existing code ...
        cardManager.addCard(scannedUid);
        buzzer.playPattern(PATTERN_ADD_SUCCESS);
        
        // Send to web server
        APIHandler::sendCardToWebServer(scannedUid, "New Card");
        APIHandler::sendLogToWebServer(scannedUid, "New Card", "registered", true);
        
        currentState = STATE_IDLE;
    }
    break;
```

## Testing

1. Pastikan Next.js server berjalan:
   ```bash
   cd smart-door-web
   npm run dev
   ```

2. Cek IP komputer Anda di network yang sama dengan ESP32:
   ```bash
   ifconfig | grep "inet "
   ```

3. Update `WEB_SERVER_IP` di `config.h` dengan IP komputer Anda

4. Upload code ke ESP32

5. Monitor Serial untuk debug:
   ```
   [API] Sending log to: http://10.10.1.100:3000/api/logs
   [API] Payload: {"cardUid":"BE:02:28:DB","action":"unlock","success":true}
   [API] Response code: 200
   [API] Response: {"success":true,"log":{...}}
   ```

6. Cek logs di dashboard: http://localhost:3000/logs

## Troubleshooting

### ESP32 tidak bisa connect ke server:
- Pastikan komputer dan ESP32 di network yang sama
- Cek firewall komputer (port 3000 harus terbuka)
- Ping dari komputer ke ESP32: `ping 10.10.1.5`
- Test endpoint manual: `curl http://localhost:3000/api/logs`

### Error 401 Unauthorized:
- Pastikan `X-API-Key` header sama dengan `ESP32_API_KEY` di `.env.local`
- Restart Next.js dev server setelah edit `.env.local`

### Error 500 Internal Server Error:
- Cek console Next.js untuk error details
- Pastikan direktori `data/` dan file `logs.json` ada
- Cek permission file
