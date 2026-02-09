# Smart Door Lock System - Integration Guide

Panduan lengkap untuk mengintegrasikan Web Dashboard dengan ESP32 Smart Door Lock.

## 📋 Ringkasan Sistem

### Arsitektur
```
┌─────────────────┐          ┌──────────────┐          ┌─────────────┐
│  Web Dashboard  │◄────────►│    ESP32     │◄────────►│  Hardware   │
│   (Next.js)     │  API +   │  (Firmware)  │          │  (RFID/Lock)│
│                 │  WebSocket│              │          │             │
└─────────────────┘          └──────────────┘          └─────────────┘
```

### Komponen
1. **Web Dashboard** (`smart-door-web/`)
   - Next.js 15, TypeScript, Tailwind CSS
   - Real-time monitoring via WebSocket
   - Door control, card management, access logs

2. **ESP32 Firmware** (`smart-door-iot/`)
   - REST API endpoints
   - WebSocket server
   - RFID card reader
   - Door lock controller

## 🚀 Quick Start

### 1. Upload Firmware ke ESP32

```bash
cd smart-door-iot

# Compile & upload via USB
pio run -t upload -e esp32dev

# ATAU upload via OTA (jika sudah terinstall)
pio run -t upload -e esp32dev-ota
```

**Catatan:** Firmware baru sudah include:
- REST API endpoints (`/api/*`)
- WebSocket server (`/ws`)
- ArduinoJson library
- Broadcast card scan events

### 2. Setup Web Dashboard

```bash
cd smart-door-web

# Install dependencies
npm install

# Development mode
npm run dev

# Production build
npm run build
npm start
```

Web dashboard akan berjalan di `http://localhost:3000`

### 3. Konfigurasi IP Address

**Option A: Via Web Settings**
1. Buka web dashboard
2. Go to **Settings** page
3. Masukkan IP ESP32 (default: `10.10.1.5`)
4. Click **Save**

**Option B: Edit kode**
Edit `smart-door-web/lib/config.ts`:
```typescript
export const DEFAULT_ESP32_IP = '10.10.1.5'; // Ubah sesuai ESP32 Anda
```

## 🔄 Data Flow

### 1. Real-time Updates (WebSocket)

```
ESP32 Event          WebSocket Message           Web Dashboard Action
─────────────────────────────────────────────────────────────────────
Card scanned    ──►  {type: "card_scan"}    ──►  Show toast notification
                     {success: true/false}        Add to access log
                                                  Update last access

Door unlocked   ──►  {type: "door_status"}  ──►  Update door status card
                     {doorUnlocked: true}         Animate status change

System update   ──►  {type: "system_info"}  ──►  Update system info
                     {rssi: -45}
```

### 2. User Actions (REST API)

```
User Action         API Request              ESP32 Response
────────────────────────────────────────────────────────────
Click "Open Door"  ► POST /api/door/unlock ► {success: true}
                                               Broadcast status via WS

Add card           ► POST /api/cards        ► {success: true, count: 6}
                     {uid: "BE:02:28:DB"}     Play buzzer

Remove card        ► DELETE /api/cards/uid  ► {success: true}
                                               Play buzzer

Restart ESP32      ► POST /api/system/restart ► ESP32 reboots
```

## 📡 API Endpoints

Semua endpoints ada di `http://{ESP32_IP}/api/`

### Door Control
- `GET /api/status` - Door & system status
- `POST /api/door/unlock` - Unlock door remotely
- `POST /api/door/lock` - Lock door (manual)

### Card Management  
- `GET /api/cards` - List all registered cards
- `POST /api/cards` - Add new card
  ```json
  {"uid": "BE:02:28:DB"}
  ```
- `DELETE /api/cards/{uid}` - Remove card

### System
- `GET /api/system/info` - WiFi, uptime, firmware version
- `POST /api/system/restart` - Restart ESP32
- `POST /api/buzzer/play` - Test buzzer
  ```json
  {"pattern": "VALID_CARD"}
  ```

### WebSocket
- `ws://{ESP32_IP}/ws` - Real-time events
  - `door_status` - Door state changed
  - `card_scan` - Card scanned event
  - `system_info` - System updates

**Dokumentasi lengkap:** `smart-door-web/API.md`

## 🔧 Troubleshooting

### Web Dashboard tidak bisa connect ke ESP32

**Check:**
1. ESP32 sudah upload firmware terbaru?
2. ESP32 WiFi connected? (check serial monitor)
3. Web & ESP32 di network yang sama?
4. IP address di Settings benar?

**Debug:**
```bash
# Test API from terminal
curl http://10.10.1.5/api/status

# Expected output:
# {"doorUnlocked":false,"doorStatus":"LOCKED",...}
```

### WebSocket Connection Failed

**Solusi:**
1. Verify ESP32 IP di Settings page
2. Check browser console untuk error
3. Pastikan ESP32 firmware include `setupWebSocket()`

**Test WebSocket:**
```javascript
// Browser console
const ws = new WebSocket('ws://10.10.1.5/ws');
ws.onopen = () => console.log('Connected!');
ws.onmessage = (e) => console.log(e.data);
```

### Cards tidak muncul di web

**Check:**
1. API endpoint `/api/cards` accessible?
   ```bash
   curl http://10.10.1.5/api/cards
   ```
2. ESP32 punya registered cards?
3. Check browser console untuk error

### Build error: "Cannot find module"

**Solusi:**
```bash
cd smart-door-web
rm -rf node_modules package-lock.json
npm install
npm run build
```

## 🔒 Security Considerations

### Current Implementation (Development)
- ⚠️ No authentication
- ⚠️ Plaintext HTTP
- ⚠️ No rate limiting
- ⚠️ CORS allows all origins (`*`)

**Cocok untuk:**
- Jaringan lokal/private
- Development & testing
- Home network (isolated)

### Production Recommendations

**1. Add Authentication**
```typescript
// ESP32: Add simple API key check
if (request->header("X-API-Key") != "your-secret-key") {
  return request->send(401, "application/json", 
    "{\"error\":\"Unauthorized\"}");
}

// Web: Add API key to requests
headers: {
  'X-API-Key': 'your-secret-key'
}
```

**2. Enable HTTPS**
- Use reverse proxy (nginx/caddy) dengan SSL certificate
- ESP32 → Reverse Proxy → Web Dashboard (HTTPS)

**3. Network Security**
- Isolate IoT devices di VLAN terpisah
- Whitelist IP addresses
- Disable public WiFi access

**4. Session Management**
- Implement login system di web dashboard
- Store session tokens di httpOnly cookies
- Add logout functionality

## 📊 Features Roadmap

### Implemented ✅
- [x] Real-time door status monitoring
- [x] Remote door unlock/lock
- [x] Card management (add/remove)
- [x] Card nicknames (localStorage)
- [x] Access logs (localStorage)
- [x] Export logs (JSON/CSV)
- [x] System information
- [x] ESP32 restart
- [x] Buzzer test
- [x] WebSocket real-time updates
- [x] Toast notifications
- [x] Dark theme UI

### Planned 🔜
- [ ] User authentication
- [ ] Database integration (MySQL/PostgreSQL)
- [ ] Access statistics & charts
- [ ] Email/Telegram notifications
- [ ] Multi-user support
- [ ] Card usage analytics
- [ ] Scheduled door unlock
- [ ] Geofencing
- [ ] Mobile app (React Native)
- [ ] Webhook integration

## 🎨 Customization

### Change Theme Colors

Edit `smart-door-web/app/layout.tsx`:
```typescript
// Change primary color from blue to purple
className="bg-blue-600"  →  className="bg-purple-600"
```

### Add Custom Pages

```bash
# Create new page
mkdir smart-door-web/app/mynewpage
touch smart-door-web/app/mynewpage/page.tsx
```

### Modify Sidebar Menu

Edit `smart-door-web/components/layout/Sidebar.tsx`:
```typescript
const menuItems = [
  { name: 'Dashboard', href: '/', icon: Home },
  { name: 'My New Page', href: '/mynewpage', icon: Star }, // Add new
  // ...
];
```

## 📱 Mobile Responsive

Web dashboard sudah responsive untuk:
- Desktop (1920x1080+)
- Tablet (768x1024)
- Mobile (375x667)

Test responsiveness:
```bash
# Chrome DevTools
F12 → Toggle device toolbar (Ctrl+Shift+M)
```

## 🚢 Deployment Options

### Option 1: Vercel (Easiest)
```bash
npm install -g vercel
cd smart-door-web
vercel
```
**Free tier:** Perfect untuk personal use

### Option 2: Railway
1. Push ke GitHub
2. Connect Railway ke repo
3. Auto-deploy on push

### Option 3: VPS (Digital Ocean, Linode)
```bash
# Install Node.js 20+
cd smart-door-web
npm ci --production
npm run build
pm2 start npm --name "smart-door" -- start
```

### Option 4: Docker
```bash
docker build -t smart-door-web .
docker run -p 3000:3000 smart-door-web
```

## 📞 Support

### Documentation
- Web Dashboard: `smart-door-web/README.md`
- API Reference: `smart-door-web/API.md`
- ESP32 Firmware: `smart-door-iot/README.md`
- Wiring Guide: `smart-door-iot/wiring.md`

### Common Issues

**Q: Web dashboard bisa buka tapi tidak ada data?**
A: Check ESP32 IP address di Settings. Verify API accessible dengan `curl`.

**Q: WebSocket terus reconnecting?**
A: ESP32 mungkin restart terus-menerus. Check serial monitor.

**Q: Cards yang ditambah di web tidak tersimpan setelah ESP32 restart?**
A: Cards disimpan di NVS (non-volatile storage) ESP32, harusnya persistent. Check serial monitor untuk error.

**Q: Access logs hilang setelah clear browser cache?**
A: Logs disimpan di localStorage browser. Untuk persistent logs, perlu database integration.

---

## 🎯 Next Steps

1. **Test sistem** dengan scan kartu RFID
2. **Monitor logs** di web dashboard
3. **Customize** sesuai kebutuhan
4. **Deploy** ke hosting pilihan Anda
5. **Share feedback** untuk improvement

**Happy building! 🚀**
