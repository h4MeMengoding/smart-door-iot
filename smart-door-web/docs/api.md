# Smart Door Lock — API & MQTT Documentation

> **v2.0 — MQTT Architecture** | Updated: June 2025

## Architecture Overview

The system uses **MQTT** (via EMQX Cloud) as the primary communication layer between all components:

```
┌─────────────┐       MQTTS (8883)       ┌──────────────┐
│   ESP32      │ ◄─────────────────────► │  EMQX Cloud  │
│  (Device)    │       publish/sub       │   (Broker)    │
└─────────────┘                          └──────┬───────┘
                                                │
                                ┌───────────────┼───────────────┐
                                │ MQTTS (8883)  │ WSS (8084)    │
                                ▼               ▼               │
                          ┌──────────┐   ┌──────────┐          │
                          │ Next.js  │   │ Browser  │          │
                          │ Server   │   │ Dashboard│          │
                          └──────────┘   └──────────┘          │
```

### Communication Paths

| Path | Protocol | Purpose |
|------|----------|---------|
| ESP32 ↔ Broker | MQTTS (port 8883) | Device status, events, command responses |
| Server ↔ Broker | MQTTS (port 8883) | Process access logs, send commands via API routes |
| Browser ↔ Broker | WSS (port 8084) | Real-time dashboard updates (subscribe only) |
| Browser → Server | HTTPS | API calls (door control, card CRUD, config changes) |

### MQTT Users

| Client ID | Username | Purpose | Permissions |
|-----------|----------|---------|-------------|
| `smartdoor-esp32` | `smartdoor-esp32` | ESP32 device | Publish + Subscribe |
| `smartdoor-web-*` | `smartdoor-server` | Next.js server | Publish + Subscribe |
| `smartdoor-dash-*` | `smartdoor-web` | Browser dashboard | Subscribe only |

---

## MQTT Topics

### ESP32 → Server/Dashboard (Published by ESP32)

| Topic | QoS | Retained | Payload |
|-------|-----|----------|---------|
| `smartdoor/status` | 1 | Yes | Full door status (JSON) |
| `smartdoor/availability` | 1 | Yes | `"online"` or `"offline"` (LWT) |
| `smartdoor/system/info` | 1 | Yes | System info (JSON) |
| `smartdoor/event/card_scan` | 1 | No | Card scan event |
| `smartdoor/event/card_added` | 1 | No | Card registered |
| `smartdoor/event/card_removed` | 1 | No | Card removed |
| `smartdoor/event/registration` | 1 | No | Registration mode toggled |
| `smartdoor/event/clone` | 1 | No | Clone progress update |
| `smartdoor/event/access_log` | 1 | No | Access log entry (stored in DB) |
| `smartdoor/ota/progress` | 0 | No | OTA upload progress |
| `smartdoor/response` | 1 | No | Command response with `requestId` |

### Server/Dashboard → ESP32 (Commands)

| Topic | Purpose |
|-------|---------|
| `smartdoor/cmd/door` | Lock/unlock door |
| `smartdoor/cmd/cards` | Add/remove/list cards |
| `smartdoor/cmd/config` | Update auto-lock, card delays, schedules |
| `smartdoor/cmd/mode` | Toggle registration mode |
| `smartdoor/cmd/rfid` | Enable/disable RFID reader |
| `smartdoor/cmd/system` | Restart, get system info |
| `smartdoor/cmd/time` | Sync NTP time |
| `smartdoor/cmd/schedule` | Set scheduled restart |
| `smartdoor/cmd/ota` | Start OTA update |
| `smartdoor/ota/data` | OTA firmware data chunks |

### Command/Response Pattern

All commands use a request-response pattern with `requestId`:

**Command (published to `smartdoor/cmd/*`):**
```json
{
  "action": "unlock",
  "requestId": "abc123"
}
```

**Response (published to `smartdoor/response`):**
```json
{
  "requestId": "abc123",
  "success": true,
  "message": "Door unlocked",
  "doorUnlocked": true
}
```

---

## MQTT Payload Schemas

### Door Status (`smartdoor/status`)

```json
{
  "type": "door_status",
  "timestamp": 1719900000,
  "doorUnlocked": false,
  "doorStatus": "LOCKED",
  "state": "IDLE",
  "lastCard": "AB:CD:EF:12",
  "lastEvent": "Card scanned",
  "cardCount": 5,
  "uptime": "12345s",
  "autoLockDuration": 5,
  "rfidDisabled": false,
  "rfidAutoEnableMs": 0,
  "ntpSynced": true,
  "currentHour": 14,
  "currentTime": "14:30:25"
}
```

### System Info (`smartdoor/system/info`)

```json
{
  "type": "system_info",
  "timestamp": 1719900000,
  "ip": "192.168.1.100",
  "rssi": -45,
  "firmwareVersion": "2.0.0",
  "uptime": "12345s",
  "freeHeap": 180000,
  "totalHeap": 327680,
  "usedFlash": 1048576,
  "totalFlash": 4194304,
  "partitionSize": 1966080,
  "temperature": 42.5
}
```

### Access Log Event (`smartdoor/event/access_log`)

```json
{
  "type": "access_log",
  "timestamp": 1719900000,
  "cardUid": "AB:CD:EF:12",
  "action": "unlock",
  "success": true,
  "accessType": "RFID",
  "isoTimestamp": "2025-06-15T14:30:00.000Z"
}
```

Access types: `RFID`, `WEB`, `TOUCH`

### Card Scan Event (`smartdoor/event/card_scan`)

```json
{
  "type": "card_scan",
  "timestamp": 1719900000,
  "uid": "AB:CD:EF:12",
  "success": true
}
```

### Card Added/Removed (`smartdoor/event/card_added` / `card_removed`)

```json
{
  "type": "card_added",
  "timestamp": 1719900000,
  "uid": "AB:CD:EF:12",
  "cardCount": 6,
  "allCards": ["AB:CD:EF:12", "11:22:33:44"]
}
```

### Registration Mode (`smartdoor/event/registration`)

```json
{
  "type": "registration_mode",
  "timestamp": 1719900000,
  "active": true
}
```

### Clone Status (`smartdoor/event/clone`)

```json
{
  "type": "clone_status",
  "timestamp": 1719900000,
  "state": "CLONE_MODE",
  "step": "WAIT_SOURCE",
  "sourceUID": "",
  "result": "none"
}
```

Steps: `WAIT_SOURCE`, `WAIT_TARGET`
Results: `none`, `success`, `failed`, `timeout`

---

## Web Dashboard API

Base URL: `https://h-iot.app`

All API routes require authentication via either:
- **Session cookie** (`smart-door-session`) — for dashboard users
- **API key** (`X-API-Key` header) — for iOS Shortcuts / external integrations

### Authentication

**`POST /api/auth/login`** — Login with 6-digit PIN

Request:
```json
{ "pin": "123456" }
```

**`GET /api/auth/check`** — Check session validity

**`POST /api/auth/logout`** — Clear session cookie

### Door Control

**`GET /api/door`** — Get current door status (from MQTT cache or ESP32 query)

```json
{
  "doorUnlocked": false,
  "doorStatus": "LOCKED",
  "state": "IDLE",
  "deviceOnline": true,
  "source": "mqtt_cache"
}
```

**`POST /api/door`** — Unlock or lock the door

Request:
```json
{ "action": "unlock" }
```

Response:
```json
{ "success": true, "message": "Door unlocked", "doorUnlocked": true }
```

### Cards

**`GET /api/cards`** — List cards from database (excludes master cards)

```json
[
  { "uid": "AB:CD:EF:12", "name": "My Card", "lastUsed": "2025-06-15T14:30:00Z" }
]
```

**`POST /api/cards/sync-db`** — Sync ESP32 card list to database

Request:
```json
{ "cards": ["AB:CD:EF:12", "11:22:33:44"] }
```

### Configuration

**`GET /api/config`** — Get card delays, schedules, auto-lock from database

**`PUT /api/config`** — Update configuration

Supports body fields:
- `cardDelay` — `{ uid, delay }` per-card unlock delay
- `cardSchedule` — `{ uid, startHour, endHour, delaySec }` time-based delay
- `bulkSchedule` — array of schedules
- `removeSchedule` — `{ uid }` remove schedule
- `autoLockDuration` — number (seconds)

### Access Logs

**`GET /api/logs`** — Get access logs

Query params:
- `since` — ISO timestamp for incremental fetch (e.g., `?since=2025-06-15T00:00:00Z`)
- `limit` — max entries (default: 100)

**`POST /api/logs`** — Create access log entry (ESP32 via API key only)

**`DELETE /api/logs/clear`** — Clear all access logs

### System Events

**`GET /api/system-events`** — Get recent system events (restarts, OTA, etc.)

**`POST /api/system-events`** — Create a system event

Request:
```json
{ "eventType": "restart", "description": "Manual restart triggered" }
```

### Health

**`GET /api/health/db`** — Database connectivity check

```json
{ "connected": true, "latency": 12 }
```

### Documentation

**`GET /api/docs`** — Get this documentation as text

---

## iOS Shortcuts Integration

Control your smart door lock directly from iPhone, Apple Watch, Siri, Action Button, and Control Center using Apple Shortcuts.

### API Details

All shortcuts use the same MQTT-proxied API endpoint — **no direct ESP32 connection needed**:

| Property | Value |
|----------|-------|
| **Base URL** | `https://h-iot.app/api/door` |
| **Method** | `POST` (unlock/lock) or `GET` (status) |
| **Headers** | `X-API-Key: <your-api-key>` and `Content-Type: application/json` |
| **Unlock Body** | `{"action": "unlock"}` |
| **Lock Body** | `{"action": "lock"}` |

> The API key is the value of the `ESP32_API_KEY` environment variable configured in Vercel.

### Quick Test (Terminal)

Before creating shortcuts, verify the API works:

```bash
# Unlock
curl -X POST https://h-iot.app/api/door \
  -H "X-API-Key: YOUR_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{"action": "unlock"}'

# Lock
curl -X POST https://h-iot.app/api/door \
  -H "X-API-Key: YOUR_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{"action": "lock"}'

# Check status
curl https://h-iot.app/api/door \
  -H "X-API-Key: YOUR_API_KEY"
```

Expected response: `{"success": true, "message": "Door unlocked", "doorUnlocked": true}`

### Create "Unlock Door" Shortcut

1. Open the **Shortcuts** app on iPhone
2. Tap **+** (top right) to create a new shortcut
3. Tap **Add Action**, search for **"Get Contents of URL"**
4. Set the URL to: `https://h-iot.app/api/door`
5. Tap **Show More** → set **Method** to `POST`
6. Under **Headers**, add:
   - Key: `X-API-Key` — Value: `YOUR_API_KEY`
   - Key: `Content-Type` — Value: `application/json`
7. Under **Request Body**, select **JSON** and add:
   - Key: `action` (Text) — Value: `unlock`
8. *(Optional)* Add a **"Show Notification"** action: `🔓 Door unlocked!`
9. Rename the shortcut to **"Unlock Door"**, pick an icon and color
10. Tap **Done**

### Create "Lock Door" Shortcut

Same steps as above, but in step 7 set the action value to `lock`. Name it **"Lock Door"** 🔒

### Shortcut with Confirmation Dialog

To prevent accidental unlocks:

1. Add action: **"Show Alert"**
   - Title: `Unlock Door?`
   - Message: `Are you sure you want to unlock the door?`
   - Show Cancel Button: **ON**
2. Add action: **"Get Contents of URL"** (configured as above with unlock)
3. Add action: **"Show Notification"** → `🔓 Door unlocked!`

If the user taps Cancel, the shortcut stops. If OK, the door unlocks.

### Toggle Shortcut (Unlock/Lock)

One shortcut that checks the current state and toggles:

1. **"Get Contents of URL"** → `GET https://h-iot.app/api/door` with `X-API-Key` header
2. **"Get Dictionary Value"** → key: `doorUnlocked`
3. **"If"** → condition: **is** `1` (door is unlocked → lock it)
4. Inside **If**: POST with `{"action": "lock"}` → Notification `🔒 Door locked!`
5. Inside **Otherwise**: POST with `{"action": "unlock"}` → Notification `🔓 Door unlocked!`
6. **End If**

### Where to Use Your Shortcuts

**Home Screen Icon:**
1. In Shortcuts app, tap **⋯** on your shortcut
2. Tap the **share icon** → **Add to Home Screen**
3. Customize the icon and name → Tap **Add**

**Home Screen Widget:**
1. Long-press home screen → tap **+** (top left)
2. Search **Shortcuts** → choose widget size
3. Tap the widget → select your shortcut

**Siri Voice Command:**
Simply say: *"Hey Siri, Unlock Door"* — Siri uses the shortcut name as the voice command.

**Action Button (iPhone 15 Pro / 16+):**
1. Go to **Settings → Action Button**
2. Select **Shortcut** → choose your unlock/lock shortcut

**Control Center (iOS 18+):**
1. Open Control Center (swipe down from top-right)
2. Long-press → tap **+** → **Add a Control**
3. Select **Shortcuts** → choose your shortcut

**Apple Watch:**
Shortcuts sync automatically to Apple Watch. Open the Shortcuts app on your watch or add it as a watch face complication.

### Automations

**Location-Based (Geofence):**
1. Shortcuts → **Automation** tab → **+**
2. Select **Arrive** → set your home location
3. Add the unlock action (POST to `/api/door`)
4. Disable **"Ask Before Running"** for fully automatic unlock

**NFC Tag:**
1. Shortcuts → **Automation** → **+** → **NFC**
2. Scan an NFC tag placed near your door
3. Add the unlock action
4. Disable **"Ask Before Running"**

### Troubleshooting

| Issue | Solution |
|-------|----------|
| 401 Unauthorized | Verify `X-API-Key` matches `ESP32_API_KEY` in Vercel env |
| 503 Device offline | ESP32 is not connected to MQTT broker |
| Timeout / slow response | Check ESP32 WiFi and MQTT connection |
| Shortcut not in Siri | Ensure shortcut name is unique, no special characters |
| Action Button unavailable | Only on iPhone 15 Pro / 16 and later |
| Control Center shortcut missing | Requires iOS 18 or later |

---

## Deployment

### Vercel (Web Dashboard)

Environment variables required:
- `ESP32_API_KEY` — Shared API key
- `AUTH_SESSION_SECRET` — Random secret for session signing
- `DASHBOARD_PIN_HASH` — SHA-256 hash of dashboard PIN
- `DASHBOARD_PIN_SALT` — Salt for PIN hashing
- `DATABASE_URL` — PostgreSQL connection string
- `MQTT_BROKER_URL` — EMQX broker URL (mqtts://)
- `MQTT_USERNAME` — Server MQTT username
- `MQTT_PASSWORD` — Server MQTT password
- `NEXT_PUBLIC_MQTT_WS_URL` — Browser MQTT WebSocket URL (wss://)
- `NEXT_PUBLIC_MQTT_WS_USERNAME` — Browser MQTT username
- `NEXT_PUBLIC_MQTT_WS_PASSWORD` — Browser MQTT password

### ESP32 (PlatformIO)

Configure in `include/config.h`:
- WiFi SSID/password
- MQTT broker URL, username, password
- API key (must match `ESP32_API_KEY`)
- NTP timezone (default: GMT+7 WIB)

Build and upload:
```bash
cd smart-door-iot
pio run -t upload        # USB upload
pio run -e esp32dev-ota -t upload   # OTA upload
```
