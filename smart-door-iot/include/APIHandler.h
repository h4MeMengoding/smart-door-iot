#ifndef API_HANDLER_H
#define API_HANDLER_H

#include <ESPAsyncWebServer.h>
#include <AsyncWebSocket.h>

// CORS headers helper
void addCorsHeaders(AsyncWebServerResponse* response);

// Authentication middleware
bool validateApiKey(AsyncWebServerRequest* request);

// Initialize API endpoints
void setupAPIEndpoints(AsyncWebServer& server);

// Config NVS helpers
void saveAutoLockToNVS(uint16_t seconds);
void saveCardDelayToNVS(const String& uidHex, uint16_t seconds);

// Initialize WebSocket
void setupWebSocket(AsyncWebServer& server);

// WebSocket broadcast functions
void broadcastDoorStatus();
void broadcastCardScan(const String& uid, bool success);
void broadcastCardAdded(const String& uid);
void broadcastCardRemoved(const String& uid);
void broadcastRegistrationMode(bool active);
void broadcastCloneStatus(const String& step, const String& sourceUID = "", const String& result = "");

// WebSocket event handler
void onWebSocketEvent(AsyncWebSocket* server, AsyncWebSocketClient* client, 
                      AwsEventType type, void* arg, uint8_t* data, size_t len);

// Handle WebSocket tasks (call from loop)
void handleWebSocketTasks();

#endif
