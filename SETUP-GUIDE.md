# Setup Guide - Smart Door Lock System

## 📋 System Architecture

```
┌──────────────────┐          ┌──────────────────┐
│   Next.js Web    │  <───>   │      ESP32       │
│   Dashboard      │   API    │   Smart Lock     │
│  (localhost:3000)│ WebSocket│  (10.10.1.5)     │
└──────────────────┘          └──────────────────┘
         │                            │
         │                            ├─ RFID Reader
         └─ Browser Access            ├─ Door Lock
                                      ├─ Touch Sensor
                                      └─ Buzzer
```

## ⚡ Quick Setup

### 1. Upload ESP32 Firmware

```bash
cd smart-door-iot
pio run -t upload -e esp32dev
```

### 2. Start Web Dashboard

```bash
cd smart-door-web
npm install
npm run dev
```

Access: http://localhost:3000

### 3. Configure IP

In web Settings page, set ESP32 IP: `10.10.1.5`

## 🌐 ESP32 Web Interface

**⚠️ IMPORTANT:** ESP32 hanya menyediakan halaman OTA update

- **URL:** http://10.10.1.5 → redirect ke `/update`
- **Purpose:** Firmware update saja (as backup when Next.js down)
- **Dashboard:** Gunakan Next.js web di http://localhost:3000

## 🔌 Endpoints

### ESP32 API
- `GET /api/status` - Door status
- `POST /api/door/unlock` - Unlock
- `POST /api/door/lock` - Lock
- `GET /api/cards` - List cards
- `POST /api/cards` - Add card
- `DELETE /api/cards/{uid}` - Remove
- `WebSocket /ws` - Real-time updates

### ESP32 OTA
- `GET /update` - Upload firmware page
- `POST /do-update` - Upload handler

## 🆘 Troubleshooting

### Web Can't Connect to ESP32

1. Check ESP32 IP di serial monitor
2. Update IP di web Settings
3. Pastikan satu network
4. Verify firmware include APIHandler

### Emergency OTA

Jika Next.js down, tetap bisa OTA via:
- http://10.10.1.5/update
- Password: `admin`

## 📖 Full Documentation

- [Web Dashboard Guide](smart-door-web/README.md)
- [API Documentation](smart-door-web/API.md)
- [ESP32 Firmware](smart-door-iot/README.md)

---

**Key Point:** ESP32 web = OTA only | Full dashboard = Next.js
