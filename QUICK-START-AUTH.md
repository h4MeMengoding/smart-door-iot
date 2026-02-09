# 🚀 Quick Start - API Authentication

## ⚡ Setup dalam 3 Langkah

### 1. Set API Key di ESP32

```bash
cd smart-door-iot
nano include/config.h
```

Edit baris ini:
```cpp
#define API_KEY  "your-secure-api-key-change-this-12345"
```

Upload:
```bash
pio run --target upload
```

### 2. Set API Key di Web Dashboard

1. Buka browser: `http://localhost:3000` (dev) or deployed URL
2. Go to **Settings** → **API Authentication**
3. Enter the same API key
4. Click **Save**

### 3. Test Connection

- Dashboard should show **green connection indicator**
- Door status updates every 2 seconds
- Try unlock/lock buttons

---

## 🔑 Default API Key

```
your-secure-api-key-change-this-12345
```

⚠️ **PENTING:** Ganti dengan key Anda sendiri untuk security!

---

## 🧪 Quick Test

Test dengan curl:
```bash
curl -H "X-API-Key: your-secure-api-key-change-this-12345" \
     http://10.10.1.5/api/status
```

Should return door status JSON.

---

## 📁 Files Changed

### ESP32:
- `include/config.h` - API key config
- `include/APIHandler.h` - Auth function
- `src/APIHandler.cpp` - Auth middleware

### Web:
- `lib/config.ts` - API key storage
- `lib/api.ts` - Added header
- `hooks/usePolling.ts` - New polling hook
- `app/page.tsx` - Use polling instead WebSocket
- `app/settings/page.tsx` - API key UI

---

## 🐛 Common Issues

**Error: Unauthorized**
→ API key tidak match atau belum di-set

**Error: Failed to connect**
→ Check ESP32 online, check IP address

**Dashboard tidak update**
→ Normal, polling interval 2 detik

---

## 📚 Full Documentation

- [SECURITY-GUIDE.md](./SECURITY-GUIDE.md) - Complete security guide
- [UPDATE-NOTES.md](./UPDATE-NOTES.md) - What changed
- [SETUP-GUIDE.md](./SETUP-GUIDE.md) - Initial setup

---

## ✅ Checklist

- [ ] API key set di ESP32
- [ ] Firmware uploaded
- [ ] API key set di web dashboard
- [ ] Connection successful (green indicator)
- [ ] Door controls working
- [ ] Status updates every 2s

Done! 🎉
