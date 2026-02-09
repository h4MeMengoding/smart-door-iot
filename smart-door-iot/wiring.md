# 🔌 Complete Wiring Guide - ESP32 DevKit V1

## 📋 Komponen yang Digunakan

1. **ESP32 DevKit V1** (30 pin)
2. **MFRC522 RFID Reader**
3. **Buzzer Aktif**
4. **Relay Module 1 Channel (5V)**
5. **Touch Sensor TTP223B** (untuk exit dari dalam)

---

## 🔌 WIRING LENGKAP

### 1️⃣ MFRC522 RFID Reader

| Pin MFRC-522 | Pin ESP32 | GPIO | Keterangan                    |
|--------------|-----------|------|-------------------------------|
| **SDA**      | D5        | 5    | VSPI Slave Select             |
| **SCK**      | D18       | 18   | VSPI Serial Clock             |
| **MOSI**     | D23       | 23   | VSPI Master Out Slave In      |
| **MISO**     | D19       | 19   | VSPI Master In Slave Out      |
| **RST**      | D4        | 4    | Reset                         |
| **GND**      | GND       | -    | Ground                        |
| **3.3V**     | 3.3V      | -    | Power Supply ⚠️ JANGAN 5V!   |
| **IRQ**      | -         | -    | Tidak digunakan               |

**⚠️ PENTING:**
- **HARUS 3.3V** - Menggunakan 5V akan merusak modul!
- Gunakan kabel jumper yang baik dan tidak terlalu panjang

---

### 2️⃣ Buzzer Aktif

| Pin Buzzer   | Pin ESP32 | GPIO | Keterangan                    |
|--------------|-----------|------|-------------------------------|
| **(+) Panjang** | D25    | 25   | Signal Output                 |
| **(-) Pendek**  | GND    | -    | Ground                        |

**Catatan:**
- Gunakan buzzer aktif 3.3V atau 5V
- Kaki panjang = positif (+) ke GPIO
- Kaki pendek = negatif (-) ke GND

---

### 3️⃣ Relay Module 1 Channel (NO - Normally Open)

#### Power & Control

| Pin Relay    | Pin ESP32     | GPIO | Keterangan                    |
|--------------|---------------|------|-------------------------------|
| **VCC**      | 5V            | -    | Power untuk relay coil        |
| **GND**      | GND           | -    | Ground                        |
| **IN**       | D32           | 32   | Control Signal                |

**Jumper:** JD-VCC dan VCC di-short (dijumper)

#### Output (untuk beban)

| Terminal Relay | Koneksi                      |
|----------------|------------------------------|
| **COM**        | Power supply beban (+)       |
| **NO**         | Beban (+) (lampu/motor/dll)  |
| **NC**         | TIDAK DIGUNAKAN              |

**⚠️ CATATAN RELAY:**
- **Default OFF** = NO terbuka = Beban MATI
- **Relay ON** = NO tertutup COM-NO = Beban HIDUP
- Jika relay tidak klik, gunakan power supply eksternal 5V 1A
- Sambungkan beban ke **COM dan NO** (BUKAN NC!)

---

### 4️⃣ Touch Sensor TTP223B

| Pin Touch    | Pin ESP32 | GPIO | Keterangan                    |
|--------------|-----------|------|-------------------------------|
| **VCC**      | 3.3V      | -    | Power Supply                  |
| **GND**      | GND       | -    | Ground                        |
| **SIG/I/O**  | D33       | 33   | Digital Output Signal         |

**Catatan:**
- Touch sensor untuk **exit dari dalam** tanpa autentikasi
- Output HIGH saat tersentuh, LOW saat tidak
- Modul sudah ada debouncing hardware, tapi tetap pakai software debounce
- Range power 2-5.5V, aman untuk 3.3V ESP32

---

## 📊 Pin Summary

| Komponen      | GPIO | Pin  | Fungsi                        |
|---------------|------|------|-------------------------------|
| RFID SDA      | 5    | D5   | SPI Slave Select              |
| RFID SCK      | 18   | D18  | SPI Clock                     |
| RFID MOSI     | 23   | D23  | SPI Master Out                |
| RFID MISO     | 19   | D19  | SPI Master In                 |
| RFID RST      | 4    | D4   | RFID Reset                    |
| Buzzer        | 25   | D25  | Audio Feedback                |
| Relay         | 32   | D32  | Relay Control (Solenoid)      |
| Touch Sensor  | 33   | D33  | Exit Button (Inside)          |
| LED Built-in  | 2    | D2   | Visual Indicator              |

---

## 🔋 Power Requirements

### Dari ESP32:
- **3.3V** → RFID MFRC522 (max ~40mA) + Touch Sensor (~1mA)
- **5V** → Relay Module VCC (jika jumper JD-VCC-VCC terpasang)
- **GND** → Semua ground bersama

### Power Supply Options:

#### Option 1: USB Power Only
```
PC USB → ESP32 (USB port)
├─ 3.3V → RFID + Touch Sensor
├─ GPIO pins → Buzzer, Touch Sensor
└─ 5V → Relay VCC (tapi 4.4V, mungkin relay tidak klik)
```

#### Option 2: External Power (RECOMMENDED)
```
Adaptor 5V 1A → ESP32 VIN + GND
├─ 3.3V → RFID + Touch Sensor
├─ GPIO pins → Buzzer, Touch Sensor
└─ 5V → Relay VCC (full 5V, relay akan klik dengan baik)
```

#### Option 3: Relay Power Terpisah
```
ESP32 USB Power:
├─ 3.3V → RFID + Touch Sensor
└─ GPIO pins → Buzzer, Relay IN, Touch Sensor

Relay Module:
├─ Lepas jumper JD-VCC ↔ VCC
├─ VCC → 3.3V ESP32 (logic)
├─ JD-VCC → 5V External (coil)
├─ GND → Common GND
```

---

## 🎯 Cara Kerja Sistem

### Startup:
1. RFID initialized → Beep 2x + LED kedip 2x
2. NVS loaded → Kartu user dimuat dari memory
3. WiFi connect → Web dashboard ready
4. Relay default OFF (solenoid locked)
5. Siap membaca kartu & touch sensor

### Akses dari Luar (RFID):

#### Kartu User (Valid):
1. Tap kartu terdaftar → LED ON + Buzzer 1x pendek
2. Relay ON → Solenoid unlock
3. Tunggu 5 detik
4. Relay OFF → Solenoid lock otomatis

#### Kartu Tidak Terdaftar:
1. Tap kartu tidak valid → Buzzer 1x panjang
2. Relay tetap OFF (solenoid locked)
3. Bisa coba lagi tanpa batas

#### Master Card (Registrasi):
1. Tap master card → Buzzer rapid beeps (mode registration)
2. Mode aktif selama 15 detik
3. Tap kartu baru → ADD (buzzer 2x pendek)
4. Tap kartu terdaftar → REMOVE (buzzer panjang+pendek)
5. Timeout/tidak ada aktivitas → keluar mode (buzzer panjang)

### Akses dari Dalam (Touch Sensor):
1. Sentuh touch sensor → Buzzer 1x pendek
2. Relay ON → Solenoid unlock (tanpa autentikasi)
3. Tunggu 5 detik
4. Relay OFF → Solenoid lock otomatis

### Contoh Sequence:
```
[Startup]              → Relay OFF (locked)
[Tap kartu user]       → Unlock 5 detik → Lock otomatis
[Touch sensor]         → Unlock 5 detik → Lock otomatis
[Tap master card]      → Mode registrasi aktif
  [Tap kartu baru]     → Kartu ditambahkan ✅
  [Timeout 15s]        → Keluar mode registrasi
[Tap kartu terdaftar]  → Unlock 5 detik → Lock otomatis
```

---

## 🔊 Audio & Visual Feedback

| Event                  | LED              | Buzzer                   | Relay      |
|------------------------|------------------|--------------------------|------------|
| Startup OK             | Kedip 2x         | Beep 2x (100ms)          | OFF        |
| Startup Fail           | Constant ON      | Beep 1x panjang (500ms)  | OFF        |
| Kartu Valid            | ON selama unlock | Beep 1x (100ms)          | ON 5s      |
| Kartu Invalid          | -                | Beep 1x panjang (500ms)  | OFF        |
| Enter Reg Mode         | Blink cepat      | Beep 3x rapid (80ms)     | OFF        |
| Add Card Success       | Kedip 2x         | Beep 2x (100ms)          | OFF        |
| Remove Card Success    | Kedip 2x         | Beep panjang+pendek      | OFF        |
| Mode Timeout           | Back to slow     | Beep 1x panjang (400ms)  | OFF        |
| Touch Sensor           | ON selama unlock | Beep 1x (80ms)           | ON 5s      |

---

## 🛠️ Troubleshooting

### RFID tidak terdeteksi:
- ✅ Cek SDA → GPIO 5 (bukan 21!)
- ✅ Cek RST → GPIO 4
- ✅ Cek power 3.3V (BUKAN 5V!)
- ✅ Cek semua kabel SPI (SCK, MOSI, MISO)
- ✅ Cek GND terhubung dengan baik

### Relay LED nyala tapi tidak klik:
- ✅ Cek tegangan 5V (harus >4.5V)
- ✅ Gunakan adaptor 5V eksternal
- ✅ Atau gunakan relay 3.3V
- ✅ Pastikan jumper JD-VCC ↔ VCC terpasang

### Buzzer tidak bunyi:
- ✅ Cek polaritas (+) ke GPIO 25, (-) ke GND
- ✅ Pastikan buzzer aktif (bukan pasif)
- ✅ Test dengan buzzer lain

### Kartu tidak terbaca:
- ✅ Dekatkan kartu 2-3 cm dari RFID
- ✅ Pastikan kartu 13.56 MHz (MIFARE)
- ✅ Cek di Serial Monitor apakah RFID initialized

### Touch sensor tidak respon:
- ✅ Cek VCC → 3.3V ESP32
- ✅ Cek GND terhubung
- ✅ Cek SIG → GPIO 33
- ✅ Test dengan menyentuh sensor, LED ESP32 harus berubah
- ✅ Cek sensitivitas sensor (ada toggle di beberapa modul)

---

## 📡 Network & OTA

- **WiFi SSID:** IOT
- **Static IP:** 10.10.1.5
- **Web Dashboard:** http://10.10.1.5
- **Serial Monitor:** http://10.10.1.5/monitor
- **OTA Update:** http://10.10.1.5/ota
- **OTA Password:** admin

---

## 📸 Wiring Diagram Visual

```
┌─────────────────────────────────────────────────────────────┐
│                    ESP32 DevKit V1 (30 pin)                  │
├─────────────────────────────────────────────────────────────┤
│                                                               │
│  3.3V ──┬───────────────────────────── RFID 3.3V             │
│         └───────────────────────────── Touch VCC             │
│                                                               │
│  GND  ──┬───────────────────────────── RFID GND              │
│         ├───────────────────────────── Buzzer (-)            │
│         ├───────────────────────────── Relay GND             │
│         ├───────────────────────────── Touch GND             │
│         └───────────────────────────── (Common GND)          │
│                                                               │
│  5V   ──────────────────────────────── Relay VCC             │
│                                                               │
│  D4   ──────────────────────────────── RFID RST              │
│  D5   ──────────────────────────────── RFID SDA              │
│  D18  ──────────────────────────────── RFID SCK              │
│  D19  ──────────────────────────────── RFID MISO             │
│  D23  ──────────────────────────────── RFID MOSI             │
│                                                               │
│  D25  ──────────────────────────────── Buzzer (+)            │
│  D32  ──────────────────────────────── Relay IN              │
│  D33  ──────────────────────────────── Touch SIG             │
│                                                               │
└─────────────────────────────────────────────────────────────┘

                    RELAY OUTPUT (untuk beban)
                    ┌──────────────────────┐
Power Supply (+) ───┤ COM                  │
                    │                      │
Beban (+)       ────┤ NO   (Normally Open) │
                    │                      │
                 ┌──┤ NC   (tidak dipakai) │
                 │  └──────────────────────┘
                 │
Beban (-) ───────┴─── Power Supply (-)

Saat Relay ON: COM dan NO terhubung → Beban HIDUP 💡
Saat Relay OFF: COM dan NO terputus → Beban MATI
```

---

## ✅ Checklist Sebelum Power On

- [ ] RFID menggunakan **3.3V** (bukan 5V)
- [ ] Semua **GND terhubung** dengan baik
- [ ] Pin **SDA = GPIO 5** dan **RST = GPIO 4**
- [ ] Buzzer polaritas benar **(+) ke GPIO 25**
- [ ] Touch sensor **VCC → 3.3V, SIG → GPIO 33**
- [ ] Relay **jumper JD-VCC ↔ VCC** terpasang
- [ ] Solenoid terhubung ke **COM dan NO** (bukan NC)
- [ ] Kabel jumper **pendek dan berkualitas baik**
- [ ] Master card UID sudah diset di **config.h**
- [ ] Code sudah di-upload ke ESP32

---

**Happy Making! 🚀**
