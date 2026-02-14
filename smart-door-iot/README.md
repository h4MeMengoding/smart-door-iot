# 🔐 Smart Door Lock System

Sistem kunci pintu cerdas berbasis **ESP32** dengan autentikasi RFID, touch sensor exit, master card management, dan web monitoring.

## ✨ Fitur

- ✅ **RFID Authentication** - Akses dari luar menggunakan kartu RFID
- ✅ **Touch Sensor Exit** - Keluar dari dalam tanpa autentikasi  
- ✅ **Master Card Management** - Tambah/hapus kartu user via master card
- ✅ **NVS Storage** - Data kartu tersimpan permanen (max 15 user cards)
- ✅ **Buzzer Feedback** - 7 pola audio berbeda untuk setiap event
- ✅ **WiFi Dashboard** - Monitor status secara real-time
- ✅ **Auto-Lock** - Pintu otomatis terkunci setelah 5 detik
- ✅ **State Machine** - Arsitektur non-blocking dengan millis()

## 🛠️ Hardware Requirements

| Komponen | Spesifikasi |
|----------|-------------|
| Microcontroller | ESP32 DevKit V1 (30-pin, CH340) |
| RFID Reader | MFRC522 (13.56MHz) |
| Door Lock | Solenoid Lock 12V |
| Relay | 1 Channel 5V NO (Normally Open) |
| Exit Sensor | Touch Sensor TTP223B |
| Buzzer | Active Buzzer 3.3V/5V |
| Power Supply | - ESP32: 5V 1A via USB/VIN<br>- Solenoid: 12V terpisah |

**Catatan:** Lihat [wiring.md](wiring.md) untuk detail lengkap wiring diagram.

---

## 📥 Installation & Setup

### 1. Clone & Open Project

```bash
cd /Users/hame/Documents/smart-door-lock
```

### 2. Configure Master Card UID

**PENTING!** Sebelum upload, set UID master card Anda:

1. Upload code awal (dengan UID contoh)
2. Tap kartu yang akan dijadikan master
3. Lihat UID di Serial Monitor
4. Copy UID tersebut
5. Edit `include/config.h`:

```cpp
const byte MASTER_CARDS[MAX_MASTER_CARDS][8] = {
    {4, 0xDE, 0xAD, 0xBE, 0xEF, 0x00, 0x00, 0x00},  // Ganti dengan UID Anda
    {4, 0xCA, 0xFE, 0xBA, 0xBE, 0x00, 0x00, 0x00}   // Master card kedua (opsional)
};
```

Format: `{ukuran_UID, byte1, byte2, byte3, byte4, 0x00, 0x00, 0x00}`

### 3. Configure WiFi (Optional)

Edit `include/config.h`:

```cpp
#define WIFI_SSID           "IOT"          // Ganti dengan SSID Anda
#define WIFI_PASSWORD       ""             // Ganti dengan password WiFi

// Static IP (opsional, comment jika pakai DHCP)
#define STATIC_IP_ADDR      IPAddress(10, 10, 1, 5)
#define GATEWAY_ADDR        IPAddress(10, 10, 1, 1)
#define SUBNET_MASK         IPAddress(255, 255, 255, 0)
```

### 4. Upload ke ESP32

```bash
pio run -t upload
```

### 5. Monitor Serial Output

```bash
pio device monitor
```

Baud rate: **115200**

---

## 🎮 Cara Penggunaan

### Startup System

Saat pertama kali dinyalakan:
1. RFID initialized → Buzzer 2x beep
2. LED kedip 2x
3. NVS loaded (jumlah kartu terdaftar ditampilkan)
4. WiFi connect (jika configured)
5. System READY

### Akses Normal (User Card)

1. **Tap kartu terdaftar** → Buzzer 1x pendek
2. Solenoid unlock, LED ON
3. Tunggu 5 detik
4. Auto-lock

### Akses dari Dalam (Touch Sensor)

1. **Sentuh touch sensor** → Buzzer 1x pendek
2. Solenoid unlock (tanpa autentikasi)
3. Tunggu 5 detik
4. Auto-lock

### Mode Registrasi (Master Card)

#### Masuk Mode Registrasi:
1. **Tap master card** → Buzzer 3x rapid beeps
2. LED blink cepat (200ms interval)
3. Mode aktif selama **15 detik** (timer reset setiap ada aktivitas)

#### Add Card Baru:
1. Saat mode aktif, **tap kartu yang belum terdaftar**
2. Buzzer 2x pendek → Card added ✅
3. Mode tetap aktif (bisa tambah kartu lain)

#### Remove Card:
1. Saat mode aktif, **tap kartu yang sudah terdaftar**
2. Buzzer 1x panjang + 1x pendek → Card removed ✅
3. Mode tetap aktif

#### Keluar Mode:
- Otomatis timeout setelah 15 detik tidak ada aktivitas
- Buzzer 1x panjang
- LED kembali slow blink

### Kartu Invalid

- **Tap kartu tidak terdaftar** (di luar mode registrasi)
- Buzzer 1x panjang
- Solenoid tetap locked ❌

---

## 📡 Web Dashboard

Jika WiFi aktif, akses dashboard di:

```
http://10.10.1.5  (atau IP yang dikonfigurasi)
```

**Informasi yang ditampilkan:**
- Door status (LOCKED / UNLOCKED)
- System state (IDLE / UNLOCK / REGISTRATION_MODE)
- Last card UID scanned
- Last event
- Number of registered cards
- System uptime

Dashboard auto-refresh setiap 1 detik.

---

## 🔊 Buzzer Patterns Reference

| Event | Pattern | Deskripsi |
|-------|---------|-----------|
| RFID Init OK | 2x beep pendek (100ms) | Startup berhasil |
| RFID Init Fail | 1x beep panjang (500ms) | RFID error |
| Valid Card | 1x beep pendek (100ms) | Access granted ✅ |
| Invalid Card | 1x beep panjang (500ms) | Access denied ❌ |
| Enter Reg Mode | 3x rapid beeps (80ms) | Mode registrasi aktif |
| Add Success | 2x beep pendek (100ms) | Kartu ditambahkan |
| Remove Success | 1x panjang + 1x pendek | Kartu dihapus |
| Mode Timeout | 1x beep panjang (400ms) | Keluar mode registrasi |
| Touch Exit | 1x beep pendek (80ms) | Exit from inside |

---

## 🔧 Troubleshooting

### RFID tidak terdeteksi:
```
[RFID] ERROR: MFRC522 not detected!
```
**Solusi:**
- ✅ Cek wiring SPI: SDA=GPIO5, RST=GPIO4, SCK=18, MOSI=23, MISO=19
- ✅ Pastikan power **3.3V** (BUKAN 5V!)
- ✅ Cek kabel jumper tidak longgar
- ✅ Test dengan RFID reader lain

### Touch sensor tidak respon:
**Solusi:**
- ✅ Cek VCC → 3.3V, SIG → GPIO33, GND → GND
- ✅ Cek sensitivitas toggle (ada di modul)
- ✅ Test dengan sentuh → lihat Serial Monitor

### Relay tidak bunyi "klik":
**Solusi:**
- ✅ Gunakan power supply eksternal 5V 1A
- ✅ Pastikan jumper JD-VCC ↔ VCC terpasang
- ✅ Atau gunakan relay 3.3V

### WiFi tidak connect:
```
[WiFi] Connection timeout - continuing offline
```
**Solusi:**
- ✅ Cek SSID dan password di `config.h`
- ✅ Pastikan WiFi 2.4GHz (ESP32 tidak support 5GHz)
- ✅ Cek jangkauan WiFi
- ✅ System tetap jalan offline jika WiFi gagal

### NVS penuh (max 15 cards):
```
[NVS] ERROR: Card storage full!
```
**Solusi:**
- Hapus beberapa kartu menggunakan master card
- Atau edit `MAX_USER_CARDS` di `config.h` dan re-upload

---

## ⚙️ Konfigurasi Lanjutan

Edit `include/config.h` untuk custom settings:

```cpp
// Timing
#define UNLOCK_DURATION         5000    // Durasi unlock (ms)
#define REGISTRATION_TIMEOUT    15000   // Timeout mode registrasi (ms)
#define RFID_COOLDOWN_TIME      1000    // Anti-duplicate tap delay (ms)

// Limits
#define MAX_USER_CARDS          15      // Max kartu user
#define MAX_MASTER_CARDS        2       // Max kartu master
```

---

## 📁 Struktur Project

```
smart-door-lock/
├── src/
│   └── main.cpp              # Main program (1100+ lines)
├── include/
│   ├── config.h              # Configuration (pins, WiFi, patterns)
│   └── README                
├── lib/                      # Empty (libraries via platformio.ini)
├── test/                     # Empty
├── platformio.ini            # PlatformIO configuration
├── wiring.md                 # Complete wiring diagram
├── brief.md                  # Project requirements
└── README.md                 # This file
```

---

## 🧩 Pin Assignment Summary

| GPIO | Pin | Function | Component |
|------|-----|----------|-----------|
| 4 | D4 | RFID RST | MFRC522 |
| 5 | D5 | RFID SDA | MFRC522 |
| 18 | D18 | SPI SCK | MFRC522 |
| 19 | D19 | SPI MISO | MFRC522 |
| 23 | D23 | SPI MOSI | MFRC522 |
| 25 | D25 | Buzzer (+) | Active Buzzer |
| 32 | D32 | Relay IN | Relay Module |
| 33 | D33 | Touch Signal | TTP223B |
| 2 | D2 | LED (built-in) | ESP32 |

---

## 📊 Memory Usage

```
RAM:   13.5% (44,188 / 327,680 bytes)
Flash: 61.3% (803,545 / 1,310,720 bytes)
```

Masih banyak ruang untuk pengembangan fitur tambahan.

---

## 🚀 Future Development Ideas

- [ ] OTA Update support (saat ini manual via USB)
- [ ] Web interface untuk add/remove cards
- [ ] Access log dengan timestamp
- [ ] MQTT integration untuk smart home
- [ ] PIN code backup (keypad)
- [ ] Telegram bot notification
- [ ] Multiple door support

---

## 📖 References

- [ESP32 Arduino Core](https://github.com/espressif/arduino-esp32)
- [MFRC522 Library](https://github.com/miguelbalboa/rfid)
- [ESPAsyncWebServer](https://github.com/me-no-dev/ESPAsyncWebServer)
- [PlatformIO](https://platformio.org/)

---

## 📝 License

Project ini dibuat untuk keperluan edukasi dan personal use.

---

## 👨‍💻 Development Notes

**Build Info:**
- Platform: ESP32 Arduino Framework
- Build Tool: PlatformIO
- Language: C++ (Arduino framework)
- Code Style: Non-blocking, State Machine pattern
- Compilation: Success ✅ (Feb 2026)

**Known Limitations:**
- Master card detection: Single tap (bukan hold 5 detik, karena RFID sering putus kontak)
- OTA: Tidak tersedia (conflict library, perlu synchronous WebServer)
- WiFi: Optional, system tetap jalan offline

---

**Status:** ✅ **READY TO DEPLOY** 

Upload code, set master card UID, dan sistem siap digunakan! 🎉
