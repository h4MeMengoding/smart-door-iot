# 🔐 Security & Authentication Guide

## Overview

Sistem Smart Door Lock sekarang menggunakan **API Key Authentication** untuk komunikasi yang aman antara Web Dashboard dan ESP32, menggantikan WebSocket dengan REST API polling.

## 🎯 Perubahan Utama

### Arsitektur:
- ✅ **WebSocket untuk real-time communication** (instant updates, no delay)
- ✅ **API Key Authentication** pada WebSocket dan REST API
- ✅ **CORS enabled** untuk remote access
- ✅ **Aman untuk hosting** di luar network

### Keamanan:
- ✅ API Key required untuk semua WebSocket connections
- ✅ API Key required untuk semua REST API requests
- ✅ Auto-reconnect dengan authentication
- ✅ Secure real-time updates tanpa polling delay

---

## 📝 Setup Guide

### 1️⃣ Konfigurasi ESP32

#### Edit `smart-door-iot/include/config.h`:

```cpp
// ============================================
// 🔐 API AUTHENTICATION CONFIGURATION
// ============================================

#define ENABLE_API_AUTH     true    // Enable/disable API authentication
#define API_KEY             "your-secure-api-key-change-this-12345"  // ⚠️ GANTI INI!
#define API_KEY_HEADER      "X-API-Key"  // Header name untuk API key
```

**⚠️ PENTING:**
- Ganti `API_KEY` dengan string random yang aman
- Gunakan kombinasi huruf, angka, dan simbol
- Minimal 20 karakter
- Contoh: `"MyS3cur3D00rL0ck!K3y#2024"`

#### Generate API Key (opsional):

Gunakan command berikut untuk generate random API key:

**macOS/Linux:**
```bash
openssl rand -base64 32
```

**Windows (PowerShell):**
```powershell
-join ((48..57) + (65..90) + (97..122) | Get-Random -Count 32 | ForEach-Object {[char]$_})
```

#### Upload ke ESP32:

```bash
cd smart-door-iot
pio run --target upload
```

---

### 2️⃣ Konfigurasi Web Dashboard

#### Di Browser:

1. Buka web dashboard
2. Pergi ke **Settings** (⚙️)
3. Scroll ke section **API Authentication**
4. Masukkan API Key yang sama dengan di ESP32
5. Klik **Save**

![API Key Settings](https://via.placeholder.com/600x200?text=API+Key+Settings)

#### Environment Variables (untuk production):

Jika deploy ke hosting (Vercel, Netlify, dll), tambahkan:

```env
NEXT_PUBLIC_ESP32_IP=your.esp32.ip.address
NEXT_PUBLIC_API_KEY=your-api-key-here
```

Kemudian update `lib/config.ts`:

```typescript
export function getApiKey(): string {
  if (typeof window === 'undefined') return process.env.NEXT_PUBLIC_API_KEY || '';
  return localStorage.getItem(API_KEY_STORAGE_KEY) || process.env.NEXT_PUBLIC_API_KEY || '';
}
```

---

## 🔒 Security Features

### 1. API Key Authentication

Setiap request ke ESP32 harus menyertakan header:

```
X-API-Key: your-secure-api-key-change-this-12345
```

Tanpa header ini atau dengan key yang salah, request akan ditolak dengan response `401 Unauthorized`.

### 2. CORS Configuration

ESP32 mengizinkan CORS dari semua origin (`*`) untuk fleksibilitas, tapi dilindungi dengan API key.

Jika ingin restrict origin tertentu, edit di `APIHandler.cpp`:

```cpp
void addCorsHeaders(AsyncWebServerResponse* response) {
    response->addHeader("Access-Control-Allow-Origin", "https://yourdomain.com");
    response->addHeader("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS");
    response->addHeader("Access-Control-Allow-Headers", "Content-Type, X-API-Key");
}
```

### 3. WebSocket + API Key Authentication

WebSocket sekarang **fully authenticated** dengan API key:

**Cara Kerja:**
1. Client membuat WebSocket connection ke `ws://ip:port/ws?apikey=your-api-key`
2. ESP32 memvalidasi API key dari query parameter
3. Jika valid → connection accepted, real-time updates dimulai
4. Jika invalid/missing → connection rejected (close code 1008)

**Format URL:**
```
ws://10.10.1.5:80/ws?apikey=your-secure-api-key-change-this-12345
```

**Update Rate:** Instant (0ms delay) - perubahan status dikirim segera via WebSocket broadcast

### 4. REST API Fallback

REST API tetap tersedia sebagai fallback atau untuk one-time requests:

```
GET  /api/status       - Memerlukan X-API-Key header
POST /api/door/unlock  - Memerlukan X-API-Key header
```

Tanpa header atau dengan key yang salah → `401 Unauthorized`

---

## 🌐 Remote Access Setup

### Port Forwarding (Router)

Untuk akses dari luar network:

**⚠️ CATATAN:** WebSocket via HTTPS tunnel memerlukan WSS (WebSocket Secure). Gunakan `wss://abc123.ngrok.io/ws?apikey=xxx` untuk WebSocket connection
2. Cari **Port Forwarding** atau **Virtual Server**
3. Tambahkan rule:
   - **External Port:** 8080 (atau port pilihan Anda)
   - **Internal Port:** 80
   - **Internal IP:** 10.10.1.5 (IP ESP32)
   - **Protocol:** TCP

4. Di web dashboard settings, set IP ke public IP Anda + port

### Tunnel (Alternative - Lebih Mudah)

Gunakan service seperti **ngrok** atau **Cloudflare Tunnel**:

#### Ngrok:
```bash
ngrok http 10.10.1.5:80
```

Akan generate URL seperti: `https://abc123.ngrok.io`

Masukkan URL ini ke web dashboard settings (tanpa protocol).

---

## 🧪 Testing

### Test dengan cURL:

```bash
# Dengan API Key (berhasil)
curl -H "X-API-Key: your-secure-api-key-change-this-12345" \
     http://10.10.1.5/api/status

# Tanpa API Key (gagal - 401)
curl http://10.10.1.5/api/status

# Response: {"success":false,"message":"Unauthorized - Invalid or missing API key"}
```

### Test dari Web Dashboard:

1. Buka browser console (F12)
2. Pergi ke Network tab → filter "WS" untuk WebSocket
3. Refresh dashboard
4. Lihat WebSocket connection: harus connect ke `/ws?apikey=...`
5. Messages tab: harus menerima `door_status` dan `card_scan` events
6. Connection status: harus **connected** (real-time updates aktif)

**Expected Console Output:**
```
WebSocket connected - Real-time updates enabled
```
WebSocket disconnected` atau tidak bisa connect

**Solusi:**
1. Pastikan API key di web dashboard sudah di-set dan **sama persis** dengan ESP32
2. Check browser console untuk error message
3. Pastikan ESP32 online (ping IP address)
4. Check firewall tidak block port 80
5. Pastikan firmware sudah di-upload (cek Serial Monitor untuk verifikasi)
6. Test WebSocket manual: `websocat ws://10.10.1.5/ws?apikey=your-key` (install websocat via `brew install websocat`)

### Error: `Failed to connect to ESP32` (REST API)

**Solusi:**
1. Check ESP32 online (ping IP address)
2. Check firewall tidak block port 80
3. Pastikan di network yang sama (untuk local access)
4. Check IP address sudah benar

### Dashboard tidak update real-time

**Kemungkinan:**
1. WebSocket disconnected - check connection status di System Info card
2. API key salah - WebSocket akan auto-reject
3. Browser console menunjukkan error - check untuk troubleshooting

**Debug Steps:**
1. Buka browser console (F12)
2. Check untuk WebSocket error messages
3. Verify connection status shows "Connected" (green dot)
4. Test manual unlock/lock - harus update instant
5. Check Serial Monitor ESP32 untuk logs: `[WebSocket] Client #X connected Pastikan di network yang sama (untuk local access)
4. Check IP address sudah benar

### Dashboard tidak update real-time

**Normal!** Polling interval adalah 2 detik. Perubahan akan terlihat dalam 2 detik.

Untuk update lebih cepat, edit `usePolling.ts`:

```typescript
pollingInterval: 1000, // 1 detik
```

---

## 📊 API Endpoints
Version Lama

### Jika Anda sudah punya sistem yang berjalan:

1. **Update ESP32 firmware:**
   ```bash
   cd smart-door-iot
   pio run --target upload
   ```

2. **Update Web Dashboard:**
   - Code sudah otomatis menggunakan WebSocket
   - Tidak perlu perubahan apapun
   - Pastikan API key sudah di-set di Settings

3. **Test Connection:**
   - Buka dashboard
   - Check System Info card - harus menampilkan "Connected" (green)
   - Test unlock/lock - update harus instant (no delay)
   - Check browser console - harus ada "WebSocket connected"

### File yang Berubah:

#### ESP32:
- ✅ [src/APIHandler.cpp](smart-door-iot/src/APIHandler.cpp#L425-L460) - Added WebSocket API key validation
- ✅ [include/config.h](smart-door-iot/include/config.h#L93) - API_KEY configuration

#### Web Dashboard:
- ✅ [lib/config.ts](smart-door-web/lib/config.ts#L36) - WebSocket URL with API key query param
- ✅ [hooks/useWebSocket.ts](smart-door-web/hooks/useWebSocket.ts) - API key validation before connect
- ✅ [app/page.tsx](smart-door-web/app/page.tsx) - Use WebSocket for real-time updates

### Tidak Perlu Lagi:
- ❌ Polling dengan delay 2 detik - WebSocket instant updates
- ❌ Manual refresh - otomatis update real-time
- ❌ Port 81 terpisah - semua via port 80
File yang berubah:

### ESP32:
- ✅ `include/config.h` - Added API auth config
- ✅ `include/APIHandler.h` - Added `validateApiKey()`
- ✅ `src/APIHandler.cpp` - Added auth middleware to all endpoints

### Web Dashboard:
- ✅ `lib/config.ts` - Added API key functions
- ✅ `lib/api.ts` - Added `X-API-Key` header
- ✅ `hooks/usePolling.ts` - New polling hook (replaces WebSocket)
- ✅ `app/page.tsx` - Use `usePolling` instead of `useWebSocket`
- ✅ `app/settings/page.tsx` - Added API key configuration UI

### Tidak Diperlukan Lagi:
- ❌ `hooks/useWebSocket.ts` - Deprecated (optional: bisa dihapus)
- ❌ WebSocket port 81 - Tidak digunakan lagi

---

## ⚙️ Advanced Configuration

### Disable Authentication (Development Only)

Edit [config.h](smart-door-iot/include/config.h):

```cpp
#define ENABLE_API_AUTH     false    // ⚠️ JANGAN untuk production!
```

Upload ulang firmware. Semua WebSocket dan API requests akan diterima tanpa API key.

### Custom Header Name (REST API)

Edit [config.h](smart-door-iot/include/config.h):

```cpp
#define API_KEY_HEADER      "Authorization"  // Gunakan header standar
```

Update [lib/api.ts](smart-door-web/lib/api.ts):

```typescript
headers: {
  'Authorization': `Bearer ${apiKey}`,
  // ...
}
```

**Note:** WebSocket tetap menggunakan query parameter `?apikey=xxx`

### WebSocket Connection Settings

Edit [hooks/useWebSocket.ts](smart-door-web/h production
2. ✅ **Jangan commit** API key ke Git (.gitignore untuk env files)
3. ✅ **Gunakan HTTPS/WSS** untuk production (dengan reverse proxy atau tunnel)
4. ✅ **Rotasi API key** secara berkala untuk security
5. ✅ **Monitor Serial logs** untuk deteksi unauthorized access attempts
6. ✅ **Test WebSocket connection** setelah setiap firmware update
7. ✅ **Backup configuration** sebelum update firmware
8. ✅ **Use strong API keys** - minimum 20 karakter, kombinasi alphanumeric

**API Key Security Tips:**
- Jangan share API key via email/chat
- Jangan hardcode di frontend code yang di-commit
- Gunakan localStorage atau environment variables
- Regenerate jika suspect compromised

---

## 📞 Support


Jika ada masalah atau pertanyaan:

1. Check [Troubleshooting](#-troubleshooting) section di atas
2. Lihat Serial Monitor ESP32 untuk detailed logs
3. Check browser console (F12) untuk WebSocket/API errors
4. Verify API key configuration di kedua ESP32 dan web dashboard
5. Test basic connectivity: ping ESP32 IP
6. Refer to main README.md untuk general setup

**Debug Checklist:**
- [ ] ESP32 online dan accessible (ping test)
- [ ] Firmware uploaded successfully (check Serial Monitor)
- [ ] API key sama di ESP32 dan web dashboard
- [ ] WebSocket shows "connected" di browser console
- [ ] No firewall blocking port 80
- [ ] Browser supports WebSocket (all modern browsers do)

---

**Version:** 3.0.0 (WebSocket + API Authentication)  
**Last Updated:** February 6, 2026  
**Real-time Updates:** ✅ Enabled (0ms delay)ke Git
3. ✅ **Gunakan HTTPS** untuk production (dengan reverse proxy)
4. ✅ **Rotasi API key** secara berkala
5. ✅ **Rate limiting** (optional - untuk mencegah brute force)
6. ✅ **Monitor access logs** untuk deteksi akses tidak sah

---

## 📞 Support

Jika ada masalah atau pertanyaan:

1. Check troubleshooting section di atas
2. Lihat Serial Monitor ESP32 untuk logs
3. Check browser console untuk error messages
4. Refer to main README.md

---

**Version:** 2.0.0 (API Authentication)  
**Last Updated:** February 2026
