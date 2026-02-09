# Smart Door Lock - ESP32 API Documentation

Dokumentasi REST API dan WebSocket untuk ESP32 Smart Door Lock system.

## Base URL

```
http://10.10.1.5
```

## API Endpoints

### 🚪 Door Control

#### Get Door Status
```http
GET /api/status
```

**Response:**
```json
{
  "doorUnlocked": false,
  "doorStatus": "LOCKED",
  "state": "IDLE",
  "lastCard": "BE:02:28:DB",
  "lastEvent": "Door locked",
  "cardCount": 5,
  "uptime": "12345s"
}
```

#### Unlock Door
```http
POST /api/door/unlock
```

**Response:**
```json
{
  "success": true,
  "message": "Door unlocked successfully"
}
```

#### Lock Door
```http
POST /api/door/lock
```

**Response:**
```json
{
  "success": true,
  "message": "Door locked successfully"
}
```

### 💳 Card Management

#### Get All Cards
```http
GET /api/cards
```

**Response:**
```json
[
  {
    "uid": "BE:02:28:DB"
  },
  {
    "uid": "CA:FE:BA:BE"
  }
]
```

#### Add New Card
```http
POST /api/cards
Content-Type: application/json

{
  "uid": "BE:02:28:DB",
  "nickname": "Hame's Card"  // optional, handled by web client
}
```

**Response:**
```json
{
  "success": true,
  "message": "Card added successfully",
  "count": 6
}
```

**Error Response:**
```json
{
  "success": false,
  "message": "Card already registered"
}
```

#### Remove Card
```http
DELETE /api/cards/BE:02:28:DB
```

**Response:**
```json
{
  "success": true,
  "message": "Card removed successfully",
  "count": 5
}
```

### ⚙️ System

#### Get System Info
```http
GET /api/system/info
```

**Response:**
```json
{
  "ip": "10.10.1.5",
  "rssi": -45,
  "uptime": "12345s",
  "firmwareVersion": "1.0.0"
}
```

#### Restart ESP32
```http
POST /api/system/restart
```

**Response:**
```json
{
  "success": true,
  "message": "Restarting ESP32..."
}
```

*ESP32 will restart immediately after sending response.*

#### Play Buzzer
```http
POST /api/buzzer/play
Content-Type: application/json

{
  "pattern": "VALID_CARD"
}
```

**Available Patterns:**
- `VALID_CARD`
- `INVALID_CARD`
- `UNLOCKED`

**Response:**
```json
{
  "success": true
}
```

## 🔌 WebSocket

### Connection

```javascript
const ws = new WebSocket('ws://10.10.1.5/ws');
```

### Message Types

#### Door Status Update
```json
{
  "type": "door_status",
  "timestamp": 1234567890,
  "data": {
    "doorUnlocked": true,
    "doorStatus": "UNLOCKED",
    "state": "UNLOCK",
    "lastCard": "BE:02:28:DB",
    "lastEvent": "Valid card: BE:02:28:DB",
    "cardCount": 5,
    "uptime": "12345s"
  }
}
```

#### Card Scan Event
```json
{
  "type": "card_scan",
  "timestamp": 1234567890,
  "data": {
    "uid": "BE:02:28:DB",
    "success": true
  }
}
```

#### System Info Update
```json
{
  "type": "system_info",
  "timestamp": 1234567890,
  "data": {
    "ip": "10.10.1.5",
    "rssi": -45,
    "uptime": "12345s"
  }
}
```

## 📋 States

### System States
- `IDLE` - Waiting for card/touch
- `AUTH_CHECK` - Validating scanned card
- `UNLOCK` - Door unlocked (6 sec timer)
- `REGISTRATION_MODE` - Master card mode (15 sec timeout)
- `ERROR` - RFID init failed

### Door Status
- `LOCKED` - Door is locked
- `UNLOCKED` - Door is unlocked

## 🔒 CORS

All API endpoints include CORS headers:
```
Access-Control-Allow-Origin: *
Access-Control-Allow-Methods: GET, POST, PUT, DELETE, OPTIONS
Access-Control-Allow-Headers: Content-Type
```

## ⚠️ Error Handling

### HTTP Status Codes
- `200` - Success
- `400` - Bad Request (invalid JSON, invalid UID format)
- `404` - Not Found (card not found)
- `500` - Internal Server Error (storage full, etc.)

### Error Response Format
```json
{
  "success": false,
  "message": "Error description"
}
```

## 📝 Notes

### Card UID Format
Supported formats:
- `BE:02:28:DB` (with colons)
- `BE0228DB` (without colons)

Both formats will be converted to uppercase and processed correctly.

### Storage Limits
- **Maximum user cards:** 15
- **Master cards:** 2 (hardcoded in firmware)
- **UID size:** Up to 7 bytes

### Auto-Lock
- Door auto-locks after **6 seconds** when unlocked
- This is hardcoded in ESP32 firmware (`UNLOCK_DURATION = 6000ms`)

### Card Nicknames
- Nicknames are **NOT** stored in ESP32
- Web client stores nicknames in localStorage
- Each browser/device has its own nickname storage

## 🔧 Implementation Example

### JavaScript Fetch
```javascript
// Unlock door
const response = await fetch('http://10.10.1.5/api/door/unlock', {
  method: 'POST',
});
const data = await response.json();
console.log(data.message);
```

### WebSocket
```javascript
const ws = new WebSocket('ws://10.10.1.5/ws');

ws.onopen = () => {
  console.log('Connected to ESP32');
};

ws.onmessage = (event) => {
  const message = JSON.parse(event.data);
  
  if (message.type === 'card_scan') {
    console.log('Card scanned:', message.data.uid);
    console.log('Success:', message.data.success);
  }
};

ws.onclose = () => {
  console.log('Disconnected from ESP32');
};
```

### cURL Examples
```bash
# Get status
curl http://10.10.1.5/api/status

# Unlock door
curl -X POST http://10.10.1.5/api/door/unlock

# Add card
curl -X POST http://10.10.1.5/api/cards \
  -H "Content-Type: application/json" \
  -d '{"uid":"BE:02:28:DB"}'

# Remove card
curl -X DELETE http://10.10.1.5/api/cards/BE:02:28:DB

# Restart ESP32
curl -X POST http://10.10.1.5/api/system/restart
```

## 🚀 Firmware Update Required

To use these API endpoints, ESP32 firmware must include:
- `APIHandler.cpp` and `APIHandler.h`
- ArduinoJson library (`bblanchon/ArduinoJson@^6.21.3`)
- Updated `WiFiManager.cpp` with API setup
- Updated `main.cpp` with WebSocket handler

See firmware upgrade guide in `/smart-door-iot/` folder.

---

**Last Updated:** February 2026
