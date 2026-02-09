# 🔄 Update Notes - WebSocket to API Authentication

## Tanggal Update
6 Februari 2026

## 🎯 Tujuan Update

Mengubah sistem komunikasi dari **WebSocket** ke **REST API dengan Polling** dan menambahkan **API Key Authentication** untuk keamanan yang lebih baik, terutama untuk deployment web dashboard di luar local network.

---

## ✨ Perubahan Utama

### 1. Authentication System
- ✅ Ditambahkan API Key authentication di semua endpoints
- ✅ Header `X-API-Key` wajib untuk setiap request
- ✅ Response `401 Unauthorized` untuk request tanpa/salah API key

### 2. Komunikasi
- ❌ **Removed:** WebSocket real-time connection
- ✅ **Added:** REST API polling (interval 2 detik)
- ✅ Lebih stabil untuk koneksi jangka panjang
- ✅ Kompatibel dengan hosting services (Vercel, Netlify, etc)

### 3. Security
- ✅ CORS headers updated untuk include `X-API-Key`
- ✅ API key disimpan di localStorage (web)
- ✅ API key dikonfigurasi di `config.h` (ESP32)

---

## 📁 File yang Berubah

### ESP32 (smart-door-iot)

#### Modified:
1. **`include/config.h`**
   - Added: API authentication configuration
   - Added: `ENABLE_API_AUTH`, `API_KEY`, `API_KEY_HEADER`

2. **`include/APIHandler.h`**
   - Added: `bool validateApiKey(AsyncWebServerRequest*)` function

3. **`src/APIHandler.cpp`**
   - Added: `validateApiKey()` implementation
   - Updated: CORS headers untuk include `X-API-Key`
   - Updated: All API endpoints dengan authentication check
   - Modified: 8 endpoints dengan auth middleware

### Web Dashboard (smart-door-web)

#### Modified:
1. **`lib/config.ts`**
   - Added: `getApiKey()` function
   - Added: `setApiKey()` function
   - Added: `API_KEY_STORAGE_KEY` constant

2. **`lib/api.ts`**
   - Added: `X-API-Key` header di semua requests
   - Updated: Error handling untuk 401 responses

3. **`app/page.tsx`**
   - Changed: `useWebSocket` → `usePolling`
   - Added: Status change detection
   - Added: Notifications untuk door events

4. **`app/settings/page.tsx`**
   - Added: API Authentication card
   - Added: API key input field
   - Added: Show/hide API key toggle

#### New Files:
5. **`hooks/usePolling.ts`**
   - New polling hook untuk replace WebSocket
   - Configurable polling interval
   - Auto status updates

#### Deprecated (dapat dihapus):
6. **`hooks/useWebSocket.ts`**
   - Tidak digunakan lagi
   - Optional: dapat dihapus dari project

---

## 🚀 Cara Update

### Untuk ESP32:

```bash
cd smart-door-iot

# 1. Edit config.h - ganti API_KEY
nano include/config.h

# 2. Upload firmware
pio run --target upload

# 3. Monitor untuk verify
pio device monitor
```

### Untuk Web Dashboard:

```bash
cd smart-door-web

# 1. Install dependencies (jika ada changes)
npm install

# 2. Run development server
npm run dev

# 3. Buka Settings, masukkan API key
# 4. Test koneksi ke ESP32
```

---

## ⚙️ Configuration Required

### 1. Set API Key di ESP32

Edit `/smart-door-iot/include/config.h`:

```cpp
#define API_KEY  "your-secure-api-key-here"  // ⚠️ GANTI INI!
```

**Recommended:** Generate random key 32+ characters.

### 2. Set API Key di Web Dashboard

1. Open web dashboard
2. Go to Settings
3. Scroll to "API Authentication"
4. Enter the same API key
5. Click Save

---

## 🔍 Testing Checklist

- [ ] ESP32 firmware uploaded successfully
- [ ] API key set di ESP32 config.h
- [ ] API key set di web dashboard settings
- [ ] Dashboard connects (green status indicator)
- [ ] Door status updates setiap 2 detik
- [ ] Unlock/Lock buttons berfungsi
- [ ] Card management (add/remove) berfungsi
- [ ] Notifications muncul saat door events
- [ ] System info ditampilkan dengan benar

---

## 🐛 Known Issues

### None at this time

Jika menemukan bug, please report dengan detail:
- Error message
- Steps to reproduce
- ESP32 serial output
- Browser console output

---

## 📊 Performance

### Before (WebSocket):
- Connection: Persistent WebSocket
- Latency: < 100ms (real-time)
- Bandwidth: Low (event-driven)
- Stability: ⭐⭐⭐ (dapat disconnect)

### After (API Polling):
- Connection: HTTP polling (2s interval)
- Latency: ~2s (polling interval)
- Bandwidth: Medium (periodic requests)
- Stability: ⭐⭐⭐⭐⭐ (lebih stabil)

---

## 🔮 Future Improvements

Possible enhancements:

1. **JWT Authentication** (jika ESP32 memory cukup)
2. **Rate Limiting** untuk prevent brute force
3. **User Management** (multiple API keys)
4. **HTTPS Support** dengan self-signed certificate
5. **Longer polling** atau **Server-Sent Events (SSE)**
6. **Access logs** dengan authentication tracking

---

## 📚 Documentation

Baca dokumentasi lengkap:
- [SECURITY-GUIDE.md](./SECURITY-GUIDE.md) - Security & authentication setup
- [SETUP-GUIDE.md](./SETUP-GUIDE.md) - Initial project setup
- [INTEGRATION.md](./INTEGRATION.md) - Integration guide

---

## 💡 Migration Notes

### Breaking Changes:
- ⚠️ WebSocket endpoint tidak digunakan lagi (port 81)
- ⚠️ Semua API requests wajib include `X-API-Key` header
- ⚠️ Default config akan reject requests tanpa API key

### Backward Compatibility:
- ✅ Semua REST API endpoints tetap sama
- ✅ Response format tidak berubah
- ✅ Card management tetap kompatibel

### If You Want to Keep WebSocket:
WebSocket handler masih ada di code tapi tidak digunakan oleh web dashboard. Jika ingin tetap gunakan WebSocket untuk local access:

1. Keep `useWebSocket.ts` hook
2. Create toggle di settings untuk pilih WebSocket/Polling
3. Implement hybrid mode (WebSocket local, API remote)

---

**Upgrade Instructions:** Follow [SECURITY-GUIDE.md](./SECURITY-GUIDE.md)  
**Questions?** Check troubleshooting section in guide.
