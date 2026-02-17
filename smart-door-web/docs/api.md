# Smart Door Lock — API Documentation

## Authentication

All ESP32 endpoints require the `X-API-Key` header. WebSocket accepts `?apikey=<key>` query parameter.

Web dashboard API routes use session cookie authentication (HMAC-signed `smart-door-session` cookie). Some routes (e.g., `/api/logs` POST) also accept `x-api-key` header for ESP32-to-server communication.

---

## ESP32 Endpoints

Base URL: `https://<esp32-host>`

### Door Status

**`GET /api/status`**

Returns current door state and device info.

```json
{
  "doorUnlocked": false,
  "doorStatus": "LOCKED",
  "state": "IDLE",
  "lastCard": "AB:CD:EF:12",
  "lastEvent": "Card scanned",
  "cardCount": 5,
  "uptime": "2h 15m",
  "autoLockDuration": 5,
  "rfidDisabled": false,
  "ntpSynced": true,
  "currentHour": 14,
  "currentTime": "14:30:25"
}
```

### Door Control

**`POST /api/door/unlock`**

Unlock the door remotely.

```json
{ "success": true, "message": "Door unlocked" }
```

**`POST /api/door/lock`**

Lock the door remotely.

```json
{ "success": true, "message": "Door locked" }
```

### Card Management

**`GET /api/cards`**

List all registered cards (excludes master cards).

```json
[
  { "uid": "AB:CD:EF:12", "nickname": "My Card" },
  { "uid": "11:22:33:44", "nickname": "" }
]
```

**`POST /api/cards`**

Add a new card.

Request:
```json
{ "uid": "AB:CD:EF:12", "nickname": "Office Card" }
```

**`POST /api/cards/remove`**

Remove a card by UID.

Request:
```json
{ "uid": "AB:CD:EF:12" }
```

**`POST /api/cards/sync`**

Sync card list from web database to ESP32.

Request:
```json
{ "uids": ["AB:CD:EF:12", "11:22:33:44"] }
```

### Registration Mode

**`POST /api/mode/register`**

Toggle registration mode. When active, scanning an unregistered card adds it; scanning a registered card removes it.

```json
{ "success": true, "registrationMode": true, "message": "Registration mode enabled" }
```

### System Info

**`GET /api/system/info`**

```json
{
  "ip": "192.168.1.100",
  "rssi": -45,
  "firmwareVersion": "1.0.0",
  "uptime": "2h 15m",
  "freeHeap": 180000,
  "totalHeap": 327680,
  "usedFlash": 1048576,
  "totalFlash": 4194304,
  "partitionSize": 1966080,
  "temperature": 42.5
}
```

**`POST /api/system/restart`**

Restart the ESP32. Device will be offline for ~10 seconds.

```json
{ "success": true, "message": "Restarting..." }
```

### Time & NTP

**`GET /api/time`**

Get current ESP32 time (NTP-synced, GMT+7 WIB).

```json
{
  "ntpSynced": true,
  "hour": 14,
  "minute": 30,
  "second": 25,
  "day": 15,
  "month": 1,
  "year": 2025,
  "time": "14:30:25",
  "date": "2025-01-15",
  "epoch": 1736930400
}
```

**`POST /api/time/sync`**

Force NTP time re-synchronization.

```json
{ "success": true, "ntpSynced": true, "time": "14:30:25" }
```

### Buzzer

**`POST /api/buzzer/play`**

Play a buzzer pattern.

Request:
```json
{ "pattern": "VALID_CARD" }
```

Patterns: `VALID_CARD`, `INVALID_CARD`, `MODE_CHANGE`, `STARTUP`

### Configuration

**`GET /api/config`**

Get auto-lock duration and card delay configs.

```json
{
  "autoLockDuration": 5,
  "cardDelays": [
    { "uid": "AB:CD:EF:12", "delay": 3 }
  ]
}
```

**`POST /api/config/autolock`**

Set auto-lock duration (seconds).

Request:
```json
{ "duration": 5 }
```

**`POST /api/config/card-delay`**

Set per-card unlock delay (seconds).

Request:
```json
{ "uid": "AB:CD:EF:12", "delay": 3 }
```

### Card Schedule (Time-based Delay)

**`GET /api/config/card-schedule`**

Get all time-based card delay schedules.

```json
{
  "success": true,
  "ntpSynced": true,
  "currentHour": 14,
  "schedules": [
    { "uid": "AB:CD:EF:12", "startHour": 22, "endHour": 8, "delaySec": 5 }
  ]
}
```

**`POST /api/config/card-schedule`**

Set or remove a time-based schedule. Supports single and bulk operations.

Single:
```json
{ "uid": "AB:CD:EF:12", "startHour": 22, "endHour": 8, "delaySec": 5 }
```

Remove:
```json
{ "uid": "AB:CD:EF:12", "remove": true }
```

Bulk:
```json
{
  "schedules": [
    { "uid": "AB:CD:EF:12", "startHour": 22, "endHour": 8, "delaySec": 5 },
    { "uid": "11:22:33:44", "startHour": 22, "endHour": 8, "delaySec": 5 }
  ]
}
```

### RFID Toggle

**`POST /api/rfid/toggle`**

Enable/disable RFID reader. When disabled, all card scans are ignored.

```json
{ "success": true, "rfidDisabled": true, "message": "RFID disabled" }
```

**`GET /api/rfid/status`**

```json
{ "rfidDisabled": false }
```

### Scheduled Restart

**`GET /api/schedule/restart`**

```json
{ "mode": 1, "hour": 3, "interval": 6 }
```

Modes: `0` = off, `1` = at specific hour daily, `2` = every X hours

**`POST /api/schedule/restart`**

Request:
```json
{ "mode": 1, "hour": 3, "interval": 6 }
```

### Clone Mode

**`GET /api/clone/status`**

```json
{
  "success": true,
  "state": "CLONE_MODE",
  "step": "WAIT_SOURCE",
  "sourceUID": "",
  "cloneResult": "none"
}
```

Steps: `WAIT_SOURCE`, `WAIT_TARGET`  
Results: `none`, `success`, `failed`, `timeout`

**`POST /api/clone/start`**

Start clone mode. Scan a source card, then a target magic card (Gen1a/Gen2).

**`POST /api/clone/cancel`**

Cancel clone mode and return to IDLE.

### OTA Update

**`POST /do-update`**

Upload a `.bin` firmware file via multipart form-data.

Field: `firmware` (binary file, max 2MB)

### WebSocket

**`GET /ws?apikey=<key>`**

Real-time event stream. Messages are JSON with `type` and `data` fields.

Message types:
- `door_status` — door state change (locked/unlocked)
- `card_scan` — card tapped
- `card_added` / `card_removed` — card registered/removed
- `registration_mode` — mode toggled
- `clone_status` — clone progress update
- `system_info` — periodic system info broadcast

---

## Web Dashboard API

Base URL: `https://<web-host>`

### Auth

**`POST /api/auth/login`** — Login with 6-digit PIN  
**`GET /api/auth/check`** — Check session validity  
**`POST /api/auth/logout`** — Clear session

### Cards (Database)

**`GET /api/cards`** — List cards from database  
**`POST /api/cards/sync-db`** — Sync cards from ESP32 to database

### Config (Database)

**`GET /api/config`** — Get card delays and schedules from database  
**`PUT /api/config`** — Update card delay, schedule, or auto-lock in database

Supports body fields: `cardDelay`, `cardSchedule`, `bulkSchedule`, `removeSchedule`, `autoLockDuration`

### Logs

**`GET /api/logs`** — Get access logs (supports `?since=<ISO>` for incremental polling)  
**`POST /api/logs`** — ESP32 posts access logs (uses `x-api-key` header)  
**`DELETE /api/logs/clear`** — Clear all access logs

### System Events

**`GET /api/system-events`** — Get recent system events  
**`POST /api/system-events`** — Create a system event

Request:
```json
{ "eventType": "restart", "description": "Manual restart triggered" }
```

### Health

**`GET /api/health/db`** — Database connectivity check
