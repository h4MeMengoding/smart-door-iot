# Smart Door Lock — MQTT Setup Guide (EMQX Cloud)

## Architecture Overview

```
┌──────────┐     MQTTS (TLS:8883)     ┌─────────────────────┐
│  ESP32   │ ◄───────────────────────► │  EMQX Cloud Broker  │
│ Firmware │   pub/sub smartdoor/*     │  (Serverless)       │
└──────────┘                           │                     │
                                       │  MQTTS  :8883       │
┌──────────┐     MQTTS (TLS:8883)      │  WSS    :8084       │
│ Next.js  │ ◄───────────────────────► │  Console:           │
│  Server  │   pub/sub smartdoor/*     │  cloud-intl.emqx.com│
└──────────┘                           └─────────────────────┘
      ▲                                         ▲
      │  HTTP API                               │  MQTT (WSS:8084)
      │  /api/esp, /api/door, /api/ota          │  sub smartdoor/*
      ▼                                         │
┌──────────┐                              ┌──────────┐
│ Browser  │  ─── real-time status ──────►│ Browser  │
│ Dashboard│                              │ MQTT.js  │
└──────────┘                              └──────────┘
```

**Communication flow:**
1. **ESP32 ↔ EMQX Cloud**: MQTTS (TLS) on port 8883 — publishes status/events, subscribes to commands
2. **Next.js Server ↔ EMQX Cloud**: MQTTS (TLS) on port 8883 — sends commands, receives events, persists logs
3. **Browser ↔ EMQX Cloud**: WSS on port 8084 — real-time door status, card events
4. **Browser → Next.js**: HTTP for commands (dashboard calls `/api/esp`, iOS Shortcuts call `/api/door`)

ESP32 **no longer exposes any HTTP API** — all communication goes through MQTT.

> **Note**: EMQX Cloud enforces TLS on all connections. No plain TCP (1883) or WS (8083).

---

## 1. Create EMQX Cloud Deployment

### 1.1 Sign Up

1. Go to [https://cloud-intl.emqx.com/](https://cloud-intl.emqx.com/)
2. Create an account or sign in
3. Click **+ New Deployment**

### 1.2 Choose Plan

- **Serverless** (free tier, recommended for single device):
  - 1M session minutes/month free
  - 1M messages/month free
  - Auto-scaling, zero maintenance
- **Dedicated** (if you need more control):
  - Fixed resources, custom config

Select **Serverless** → pick region closest to you → **Create**.

### 1.3 Get Connection Details

After deployment is created, go to the **Overview** page. Note down:

| Setting | Example | Description |
|---------|---------|-------------|
| **Connection Address** | `xxxxxx.ala.us-east-1.emqxsl.com` | Broker hostname |
| **MQTTS Port** | `8883` | TLS-encrypted MQTT (for ESP32 & server) |
| **WSS Port** | `8084` | TLS-encrypted WebSocket (for browser) |

> Copy the **Connection Address** — you'll use it everywhere as `MQTT_SERVER`.

### 1.4 Create Authentication Credentials

Go to **Access Control → Authentication** in the EMQX Cloud console.

Click **+ Add** to create credentials for each client:

| Username | Password | Description |
|----------|----------|-------------|
| `smartdoor-esp32` | `<strong-password-1>` | ESP32 device |
| `smartdoor-server` | `<strong-password-2>` | Next.js server |
| `smartdoor-web` | `<strong-password-3>` | Browser dashboard |

> Use strong, unique passwords for each. Never reuse passwords between clients.

### 1.5 Set Up Authorization (ACL)

Go to **Access Control → Authorization** in the console.

Add rules for each user:

**ESP32 (`smartdoor-esp32`):**
| Permission | Action | Topic |
|------------|--------|-------|
| Allow | Publish | `smartdoor/status` |
| Allow | Publish | `smartdoor/event/#` |
| Allow | Publish | `smartdoor/response` |
| Allow | Publish | `smartdoor/system/info` |
| Allow | Publish | `smartdoor/availability` |
| Allow | Publish | `smartdoor/ota/progress` |
| Allow | Subscribe | `smartdoor/cmd/#` |
| Allow | Subscribe | `smartdoor/ota/data` |

**Next.js Server (`smartdoor-server`):**
| Permission | Action | Topic |
|------------|--------|-------|
| Allow | Publish | `smartdoor/cmd/#` |
| Allow | Publish | `smartdoor/ota/data` |
| Allow | Subscribe | `smartdoor/status` |
| Allow | Subscribe | `smartdoor/event/#` |
| Allow | Subscribe | `smartdoor/response` |
| Allow | Subscribe | `smartdoor/system/info` |
| Allow | Subscribe | `smartdoor/availability` |
| Allow | Subscribe | `smartdoor/ota/progress` |

**Browser Dashboard (`smartdoor-web`):**
| Permission | Action | Topic |
|------------|--------|-------|
| Allow | Subscribe | `smartdoor/status` |
| Allow | Subscribe | `smartdoor/event/#` |
| Allow | Subscribe | `smartdoor/system/info` |
| Allow | Subscribe | `smartdoor/availability` |
| Allow | Subscribe | `smartdoor/ota/progress` |

### 1.6 Verify Connection

In the EMQX Cloud console, go to **Diagnose → Online Debug** (WebSocket Client).

1. It auto-fills the WSS connection details
2. Enter one of your credentials and click **Connect**
3. Subscribe to `smartdoor/#` to test
4. If connected successfully, your deployment is ready

---

## 2. Configure ESP32 Firmware

Edit `smart-door-iot/include/config.h`:

```cpp
// ── MQTT Configuration (EMQX Cloud) ──
#define MQTT_SERVER       "xxxxxx.ala.us-east-1.emqxsl.com"  // Your EMQX Cloud connection address
#define MQTT_PORT         8883                                 // EMQX Cloud MQTTS port (always TLS)
#define MQTT_USERNAME     "smartdoor-esp32"                    // Must match EMQX Cloud credential
#define MQTT_PASSWORD     "your-strong-password"               // Must match EMQX Cloud credential
#define MQTT_CLIENT_ID    "esp32-smartdoor"
#define MQTT_USE_TLS      1                                    // MUST be 1 for EMQX Cloud
#define MQTT_BUFFER_SIZE  16384                                // 16KB for large JSON payloads
#define MQTT_KEEPALIVE    60                                   // seconds
```

> **Important**: `MQTT_USE_TLS` must be `1` — EMQX Cloud does not allow unencrypted connections.

Then build and upload:

```bash
cd smart-door-iot
pio run -t upload
```

---

## 3. Configure Next.js Web App

### 3.1 Environment Variables

Add to your `.env` or `.env.local` file in `smart-door-web/`:

```env
# ── MQTT Broker — EMQX Cloud (Server-side, MQTTS) ──
MQTT_BROKER_URL=mqtts://xxxxxx.ala.us-east-1.emqxsl.com:8883
MQTT_USERNAME=smartdoor-server
MQTT_PASSWORD=your-strong-password-2

# ── MQTT Broker — EMQX Cloud (Browser, WSS) ──
NEXT_PUBLIC_MQTT_WS_URL=wss://xxxxxx.ala.us-east-1.emqxsl.com:8084/mqtt
NEXT_PUBLIC_MQTT_WS_USERNAME=smartdoor-web
NEXT_PUBLIC_MQTT_WS_PASSWORD=your-strong-password-3

# ── Existing config ──
AUTH_PIN=123456
AUTH_SESSION_SECRET=your-session-secret
ESP32_API_KEY=your-api-key-for-ios-shortcuts
DATABASE_URL=postgresql://user:pass@localhost:5432/smartdoor
```

> **Key differences from self-hosted**: Use `mqtts://` (port 8883) for server and `wss://` (port 8084) for browser. Replace `xxxxxx.ala.us-east-1.emqxsl.com` with your actual EMQX Cloud connection address.

### 3.2 Install Dependencies

```bash
cd smart-door-web
npm install
```

The `mqtt@^5` package was already added to `package.json`.

### 3.3 Start Development Server

```bash
npm run dev
```

The MQTT server client initializes automatically when `MQTT_BROKER_URL` is set.

---

## 4. MQTT Topics Reference

### Status & System

| Topic | Direction | QoS | Retained | Description |
|-------|-----------|-----|----------|-------------|
| `smartdoor/status` | ESP32 → | 1 | Yes | Door status JSON (published every 5s and on change) |
| `smartdoor/system/info` | ESP32 → | 0 | Yes | System info (uptime, heap, WiFi RSSI, firmware version) |
| `smartdoor/availability` | ESP32 → | 1 | Yes | `online` or `offline` (LWT) |

### Events (ESP32 → Server/Browser)

| Topic | Description |
|-------|-------------|
| `smartdoor/event/card_scan` | Card scanned (UID, authorized, nickname) |
| `smartdoor/event/card_added` | New card registered |
| `smartdoor/event/card_removed` | Card deleted |
| `smartdoor/event/registration` | Registration mode toggled |
| `smartdoor/event/clone` | Card clone progress |
| `smartdoor/event/access_log` | Access log entry (persisted to DB by server) |

### Commands (Server → ESP32)

| Topic | Payload Example | Description |
|-------|----------------|-------------|
| `smartdoor/cmd/door` | `{"action":"unlock","requestId":"abc"}` | Lock/unlock door |
| `smartdoor/cmd/cards` | `{"action":"list","requestId":"abc"}` | List/add/remove/rename cards |
| `smartdoor/cmd/config` | `{"action":"get_autolock","requestId":"abc"}` | Get/set auto-lock, buzzer, etc. |
| `smartdoor/cmd/mode` | `{"action":"register","requestId":"abc"}` | Enter registration/clone mode |
| `smartdoor/cmd/rfid` | `{"action":"toggle","requestId":"abc"}` | Enable/disable RFID reader |
| `smartdoor/cmd/system` | `{"action":"restart","requestId":"abc"}` | Restart ESP32 |
| `smartdoor/cmd/time` | `{"action":"get","requestId":"abc"}` | Get/set/sync ESP32 time |
| `smartdoor/cmd/schedule` | `{"action":"get","uid":"...","requestId":"abc"}` | Card delay schedules |
| `smartdoor/cmd/ota` | `{"action":"begin","size":123456,"md5":"..."}` | OTA firmware update control |

### Command Responses

| Topic | Description |
|-------|-------------|
| `smartdoor/response` | All command responses with matching `requestId` |

### OTA

| Topic | Description |
|-------|-------------|
| `smartdoor/ota/data` | Binary firmware chunks (4KB each) |
| `smartdoor/ota/progress` | OTA progress updates |

---

## 5. Request-Response Pattern

MQTT is pub/sub, not request-response. We implement request-response using `requestId` correlation:

```
Server → smartdoor/cmd/door    {"action":"unlock","requestId":"req-123"}
ESP32  → smartdoor/response    {"requestId":"req-123","success":true,"message":"Door unlocked"}
```

The Next.js server (`lib/mqtt.ts`) maintains a `pendingRequests` map. When sending a command, it generates a unique `requestId`, publishes the command, and returns a Promise. When a response arrives on `smartdoor/response`, it resolves the matching Promise.

**Timeout**: 10 seconds (configurable). If no response arrives, the Promise rejects.

---

## 6. iOS Shortcuts Integration

With MQTT, iOS Shortcuts no longer talk directly to ESP32. Instead, they call the Next.js API:

### Quick Unlock Shortcut

1. Open **Shortcuts** app → **+** New Shortcut
2. Add **Get Contents of URL** action:
   - **URL**: `https://your-domain.com/api/door`
   - **Method**: `POST`
   - **Headers**: `x-api-key: your-api-key`
   - **Body**: JSON `{"action": "unlock"}`
3. (Optional) Add **Show Result** to see response

### Lock Shortcut

Same as above but with `{"action": "lock"}`.

### Simple Toggle (default = unlock)

A `POST` to `/api/door` without a body defaults to `unlock`:
- **URL**: `https://your-domain.com/api/door`
- **Method**: `POST`
- **Headers**: `x-api-key: your-api-key`

### Get Status

- **URL**: `https://your-domain.com/api/door`
- **Method**: `GET`
- **Headers**: `x-api-key: your-api-key`

---

## 7. OTA Firmware Update via MQTT

### How It Works

1. Upload `.bin` file through the web dashboard (OTA card) or API
2. Next.js server sends `begin` command with file size and MD5 hash
3. Server streams the firmware in 4KB chunks to `smartdoor/ota/data`
4. ESP32 writes chunks to flash using Arduino `Update` library
5. ESP32 publishes progress to `smartdoor/ota/progress`
6. On completion, ESP32 verifies MD5 and restarts

### Upload via API

```bash
curl -X POST https://your-domain.com/api/ota \
  -H "Cookie: smart-door-session=your-session-cookie" \
  -F "firmware=@firmware.bin"
```

### Build Firmware for OTA

```bash
cd smart-door-iot
pio run                          # Build
# Firmware binary is at:
# .pio/build/esp32dev/firmware.bin
```

---

## 8. Troubleshooting

### ESP32 Can't Connect to MQTT

1. Check `config.h` — verify `MQTT_SERVER` matches your EMQX Cloud connection address
2. Ensure `MQTT_USE_TLS` is `1` and `MQTT_PORT` is `8883`
3. Verify credentials in EMQX Cloud console → **Access Control → Authentication**
4. Open serial monitor: `pio device monitor` — look for `[MQTT]` log lines
5. Check EMQX Cloud console → **Monitor → Clients** for connection attempts
6. Make sure ESP32 has internet access (EMQX Cloud is not on local network)

### Browser Can't Receive Real-Time Updates

1. Check browser console for MQTT connection errors
2. Verify `NEXT_PUBLIC_MQTT_WS_URL` uses `wss://` protocol and port `8084`
3. Make sure the URL ends with `/mqtt` (e.g., `wss://xxx.emqxsl.com:8084/mqtt`)
4. Verify browser credentials are created in EMQX Cloud authentication

### Next.js Server Not Receiving Events

1. Check server logs for `[MQTT]` messages at startup
2. Verify `MQTT_BROKER_URL` uses `mqtts://` protocol and port `8883`
3. Check EMQX Cloud console → **Monitor → Clients** — look for the `smartdoor-server` client
4. Test connection using the EMQX Cloud online debug tool

### "Device Offline" in Dashboard

1. ESP32 disconnected from MQTT — LWT triggers `offline` on `smartdoor/availability`
2. Check ESP32 WiFi connection and serial monitor
3. In EMQX Cloud console → **Monitor → Clients**, check connection history

### OTA Update Fails

1. Firmware file must be `.bin` format, max 2MB
2. Check serial monitor for OTA progress messages
3. Verify MQTT buffer size is large enough: `MQTT_BUFFER_SIZE` = 16384 (16KB)
4. Monitor `smartdoor/ota/progress` topic in EMQX Cloud online debug tool

### Testing with EMQX Cloud Online Debug

EMQX Cloud has a built-in MQTT test client:

1. Go to console → **Diagnose → Online Debug**
2. It auto-fills the WSS connection — enter credentials and click **Connect**
3. Subscribe to `smartdoor/#` to see all messages
4. Publish to `smartdoor/cmd/door` with `{"action":"unlock","requestId":"test-1"}` to test

### Testing with mosquitto_pub/sub

```bash
# Install mosquitto clients
brew install mosquitto  # macOS
# apt install mosquitto-clients  # Linux

# Subscribe to all topics (TLS required for EMQX Cloud)
mosquitto_sub -h xxxxxx.ala.us-east-1.emqxsl.com -p 8883 \
  -u smartdoor-server -P your-password \
  --capath /etc/ssl/certs \
  -t "smartdoor/#" -v

# Send unlock command
mosquitto_pub -h xxxxxx.ala.us-east-1.emqxsl.com -p 8883 \
  -u smartdoor-server -P your-password \
  --capath /etc/ssl/certs \
  -t "smartdoor/cmd/door" \
  -m '{"action":"unlock","requestId":"test-1"}'
```

> **macOS**: Use `--cafile /etc/ssl/cert.pem` instead of `--capath /etc/ssl/certs`.

---

## 9. Security Checklist

- [ ] Create separate MQTT credentials for ESP32, server, and browser in EMQX Cloud
- [ ] Set up ACL rules in EMQX Cloud to restrict topic access per user
- [ ] Use strong, unique passwords for each MQTT credential
- [ ] Always use `mqtts://` (port 8883) for server connections
- [ ] Always use `wss://` (port 8084) for browser connections
- [ ] Keep `ESP32_API_KEY` strong for iOS Shortcuts auth
- [ ] Keep `AUTH_SESSION_SECRET` unique and random
- [ ] Never commit `.env` files to git
- [ ] Regularly rotate MQTT passwords in EMQX Cloud console

---

## 10. Environment Variables Summary

### `smart-door-web/.env`

```env
# MQTT Broker — EMQX Cloud (MQTTS for Next.js server)
MQTT_BROKER_URL=mqtts://xxxxxx.ala.us-east-1.emqxsl.com:8883
MQTT_USERNAME=smartdoor-server
MQTT_PASSWORD=<server-mqtt-password>

# MQTT Broker — EMQX Cloud (WSS for browser, must be NEXT_PUBLIC_ prefixed)
NEXT_PUBLIC_MQTT_WS_URL=wss://xxxxxx.ala.us-east-1.emqxsl.com:8084/mqtt
NEXT_PUBLIC_MQTT_WS_USERNAME=smartdoor-web
NEXT_PUBLIC_MQTT_WS_PASSWORD=<browser-mqtt-password>

# Auth
AUTH_PIN=<6-digit-pin>
AUTH_SESSION_SECRET=<random-64-char-string>
ESP32_API_KEY=<api-key-for-ios-shortcuts>

# Database
DATABASE_URL=postgresql://user:password@localhost:5432/smartdoor
```

### `smart-door-iot/include/config.h`

```cpp
#define MQTT_SERVER       "xxxxxx.ala.us-east-1.emqxsl.com"
#define MQTT_PORT         8883
#define MQTT_USERNAME     "smartdoor-esp32"
#define MQTT_PASSWORD     "<esp32-mqtt-password>"
#define MQTT_CLIENT_ID    "esp32-smartdoor"
#define MQTT_USE_TLS      1        // MUST be 1 for EMQX Cloud
```

> Replace `xxxxxx.ala.us-east-1.emqxsl.com` with your actual EMQX Cloud connection address.
