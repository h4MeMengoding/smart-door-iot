# 🔄 OTA (Over-The-Air) Update Guide

## Smart Door Lock - OTA Update System

Fitur OTA memungkinkan Anda untuk mengupdate firmware ESP32 tanpa kabel USB, melalui WiFi network.

---

## 📋 Informasi OTA

- **Hostname**: `smart-door-lock`
- **IP Address**: `10.10.1.5` (sesuai static IP di config.h)
- **Password**: `admin` (dapat diubah di config.h - OTA_PASSWORD)
- **Port**: `3232` (default ArduinoOTA)

---

## 🚀 Cara Upload via OTA

### Method 1: PlatformIO (Terminal)

#### Upload via IP Address:
```bash
pio run -t upload --upload-port 10.10.1.5
```

#### Upload via Hostname (jika mDNS bekerja):
```bash
pio run -t upload --upload-port smart-door-lock.local
```

#### Tambahkan ke platformio.ini (opsional):
```ini
[env:esp32dev-ota]
platform = espressif32
board = esp32dev
framework = arduino
upload_protocol = espota
upload_port = 10.10.1.5
upload_flags = 
    --auth=admin
    --port=3232
```

Lalu upload dengan:
```bash
pio run -e esp32dev-ota -t upload
```

---

### Method 2: Arduino IDE

1. **Pastikan ESP32 dan komputer terhubung ke WiFi yang sama**
2. Buka Arduino IDE
3. Tools → Port
4. Pilih **Network Ports → smart-door-lock at 10.10.1.5**
5. Upload sketch seperti biasa (Ctrl+U atau Upload)
6. Masukkan password: `admin`

---

## 🔐 Fitur Keamanan

1. **Password Protection**: OTA dilindungi password (default: `admin`)
2. **Auto Lock**: Door akan otomatis terkunci saat OTA dimulai
3. **Disable Door Functions**: Semua fungsi door lock dinonaktifkan selama OTA berlangsung

---

## 🔔 Indikator OTA

### LED Indicator:
- **OTA Start**: LED ON
- **OTA Progress**: LED blink setiap 10% progress
- **OTA Success**: LED ON + buzzer beep 2x
- **OTA Error**: Buzzer beep panjang

### Serial Monitor:
```
[OTA] Update started: sketch
[OTA] Progress: 10%
[OTA] Progress: 20%
...
[OTA] Progress: 100%
[OTA] Update completed!
```

---

## 📱 Web Dashboard

Akses dashboard untuk melihat informasi OTA:
```
http://10.10.1.5
```

Dashboard menampilkan:
- Status door lock
- System information
- OTA credentials dan instructions
- Real-time system status

---

## ⚠️ Troubleshooting

### OTA tidak muncul di Arduino IDE:
1. Pastikan ESP32 terhubung ke WiFi (cek Serial Monitor)
2. Pastikan komputer dan ESP32 di network yang sama
3. Tunggu 30-60 detik setelah boot
4. Restart Arduino IDE

### Upload gagal - Connection timeout:
1. Cek IP address ESP32 di Serial Monitor
2. Ping IP address: `ping 10.10.1.5`
3. Pastikan firewall tidak memblok port 3232
4. Coba upload via IP address langsung

### Upload gagal - Auth Failed:
1. Pastikan password benar: `admin`
2. Cek OTA_PASSWORD di config.h
3. Re-upload via USB jika password berbeda

### ESP32 restart setelah OTA:
- **Normal behavior** - ESP32 akan restart otomatis setelah OTA success
- Tunggu beberapa detik, device akan boot kembali

---

## 🛠️ Mengubah Password OTA

1. Edit file `include/config.h`:
```cpp
#define OTA_PASSWORD        "passwordbaru"
```

2. Upload via USB (first time)
3. Selanjutnya gunakan password baru untuk OTA

---

## 📝 Best Practices

1. **Backup firmware** sebelum OTA update
2. **Test di development** sebelum production
3. **Jangan interrupt** proses OTA (biarkan hingga selesai)
4. **Monitor Serial** saat OTA untuk debug
5. **Stable power** - pastikan power supply stabil

---

## 🔄 Update Flow

```
1. Compile firmware baru
   ↓
2. Upload via OTA (WiFi)
   ↓
3. ESP32 receive firmware
   ↓
4. Door auto-lock (keamanan)
   ↓
5. Flash firmware
   ↓
6. Auto restart
   ↓
7. System ready dengan firmware baru
```

---

## ✅ Verifikasi OTA Success

Cek Serial Monitor setelah restart:
```
========================================
    SMART DOOR LOCK SYSTEM
========================================

[INIT] Configuring GPIO pins...
[INIT] GPIO pins configured
[NVS] Initializing NVS...
[RFID] Initializing MFRC522...
[WiFi] Connecting to WiFi...
[WiFi] Connected!
[WiFi] IP Address: 10.10.1.5
[OTA] Setting up OTA update...
[OTA] OTA update enabled
[OTA] Hostname: smart-door-lock
[OTA] Password: admin
[WEB] Web server started
========================================
SYSTEM READY
========================================
```

---

## 📞 Support

Jika ada masalah dengan OTA:
1. Cek Serial Monitor untuk error messages
2. Pastikan WiFi credentials benar di config.h
3. Test koneksi WiFi: ping IP ESP32
4. Factory reset: upload via USB

---

**Happy OTA-ing! 🚀**
