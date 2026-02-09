# 📘 Smart Door Lock System Brief

## 1. Tujuan Sistem
Membangun sistem **smart door lock** berbasis **ESP32** yang menggunakan **RFID sebagai autentikasi utama dari luar ruangan** dan **touch sensor dari dalam ruangan**, dengan mekanisme **registrasi kartu menggunakan master card**, penyimpanan data secara lokal menggunakan NVS, serta feedback audio yang jelas melalui buzzer.

Sistem dirancang **offline-first**, namun **siap dikembangkan ke IoT di masa depan**.

---

## 2. Komponen Hardware
- ESP32 Devkit V1 DOIT 30 Pin (CH340)
- RFID Reader MFRC-522 (RC522)
- Solenoid Door Lock 12V
- Relay 5V Normally Open (NO)
- Touch Sensor TTP223B
- Buzzer aktif
- Adaptor 12V khusus solenoid

---

## 3. Penyimpanan & Data
- UID kartu RFID disimpan di **NVS (Non-Volatile Storage) ESP32**
- Master card:
  - Bisa lebih dari 1 kartu
  - UID master disimpan permanen (hardcode atau NVS)
- Maksimal jumlah kartu user: **≤ 15 kartu**
- Data kartu bersifat **persisten** (tidak hilang saat reboot / listrik mati)

---

## 4. Flow Akses User – Dari Luar (RFID)

### 4.1 Kartu Valid
1. User men-tap kartu RFID
2. Sistem membaca UID
3. Jika UID **terdaftar di NVS**:
   - Relay aktif → solenoid **terbuka**
   - Buzzer: **1 beep pendek**
   - Pintu terbuka selama **X detik** (default: 5 detik, configurable di kode)
4. Setelah timeout:
   - Relay mati
   - Solenoid kembali **terkunci otomatis**

### 4.2 Kartu Tidak Valid
1. UID tidak ditemukan di NVS
2. Sistem:
   - Solenoid **tetap terkunci**
   - Buzzer: **1 beep panjang**
3. Tidak ada sistem lockout → user boleh mencoba kembali tanpa batas

---

## 5. Flow Akses User – Dari Dalam (Touch Sensor)
1. User menyentuh touch sensor
2. Sistem langsung membuka pintu:
   - **Tanpa autentikasi**
   - Relay aktif → solenoid terbuka
   - Buzzer aktif (pola khusus exit)
3. Setelah **X detik (default 5 detik)**:
   - Solenoid kembali terkunci otomatis
4. Touch sensor **selalu aktif**, tidak tergantung status pintu

---

## 6. Flow Registrasi & Manajemen Kartu

### 6.1 Masuk Mode Registrasi
1. Master card di-tap dan **ditahan / diulang selama ±5 detik**
2. Sistem masuk **MODE ADD / REMOVE CARD**
3. Indikasi:
   - Buzzer pola khusus (misal: beep pendek berulang)

### 6.2 Add Card
1. Kartu baru di-tap saat mode aktif
2. Jika UID **belum terdaftar**:
   - UID disimpan ke NVS
   - Buzzer: **beep sukses**
3. Kartu tersebut kini memiliki akses membuka pintu

### 6.3 Remove Card
1. Kartu yang **sudah terdaftar** di-tap saat mode aktif
2. UID dihapus dari NVS
3. Buzzer: **beep konfirmasi delete**

### 6.4 Timeout Mode Registrasi
- Jika tidak ada aktivitas selama periode tertentu (misal 10–15 detik):
  - Mode registrasi otomatis **keluar**
  - Buzzer: **beep timeout**

---

## 7. Buzzer & Feedback Audio
Setiap state sistem **wajib memiliki feedback audio** yang konsisten.

| Kondisi | Pola Buzzer |
|------|------------|
| Kartu valid | 1 beep pendek |
| Kartu invalid | 1 beep panjang |
| Masuk mode add/remove | beep pendek berulang |
| Add card sukses | 2 beep pendek |
| Remove card sukses | 1 beep panjang + pendek |
| Timeout mode | beep panjang |
| Touch sensor (exit) | beep pendek |

---

## 8. Power & Safety
- Solenoid 12V dikontrol via **relay NO**
- Saat listrik **mati**:
  - Relay tidak aktif
  - Solenoid **default terkunci** (fail-safe)
- ESP32 dan solenoid menggunakan **supply terpisah**

---

## 9. Konfigurasi Sistem (Configurable di Kode)
- Durasi pintu terbuka (default 5 detik)
- Timeout mode registrasi
- Pola buzzer
- Jumlah maksimal kartu

---

## 10. Scope & Future Development
- Versi awal:
  - Sistem **offline**
  - Tidak ada WiFi / cloud dependency
- Future scope (tidak diimplementasi saat ini):
  - IoT (monitoring, remote unlock, log akses)

---

## 11. Catatan untuk Developer
- Disarankan menggunakan **state machine**:
  - IDLE
  - AUTH_CHECK
  - UNLOCK
  - ADD_MODE
  - REMOVE_MODE
- Hindari penggunaan `delay()` panjang, gunakan `millis()`
- Perhatikan siklus write NVS agar tidak berlebihan
