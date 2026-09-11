# 🔓 Membuka Pintu via iPhone Shortcuts

Panduan lengkap membuat tombol **"Buka Pintu"** di iPhone menggunakan Apple Shortcuts + Smart Door API.

---

## Analisis API

Door unlock **langsung ke ESP32**, bukan melalui Next.js backend:

| Property       | Value                                        |
| -------------- | -------------------------------------------- |
| **URL**        | `POST https://esp.ilhame.id/api/door/unlock` |
| **Header**     | `X-API-Key: <your-api-key>`                  |
| **Body**       | Tidak perlu                                  |
| **Response**   | `{"success": true, "message": "..."}`        |

Untuk **mengunci** pintu:

| Property       | Value                                      |
| -------------- | ------------------------------------------ |
| **URL**        | `POST https://esp.ilhame.id/api/door/lock` |
| **Header**     | `X-API-Key: <your-api-key>`                |

---

## Step-by-Step: Membuat Shortcut "Buka Pintu"

### Step 1 — Buka App Shortcuts

1. Buka app **Shortcuts** (Pintasan) di iPhone
2. Tap tab **Shortcuts** di bagian bawah
3. Tap tombol **+** di kanan atas untuk membuat shortcut baru

### Step 2 — Tambahkan Action "Get Contents of URL"

1. Tap **Add Action** atau cari di search bar
2. Ketik **"Get Contents of URL"** (atau "Dapatkan Konten URL" jika bahasa Indonesia)
3. Tap untuk menambahkannya

### Step 3 — Konfigurasi URL

1. Tap bagian **URL** dan ketik:
   ```
   https://esp.ilhame.id/api/door/unlock
   ```

### Step 4 — Set Method ke POST

1. Tap **Show More** (atau panah biru di samping URL)
2. Ubah **Method** dari `GET` ke **`POST`**

### Step 5 — Tambahkan Header API Key

1. Di bagian **Headers**, tap **Add new header**
2. Isi:
   - **Key:** `X-API-Key`
   - **Value:** `<your-api-key>`

### Step 6 — (Opsional) Tambahkan Notifikasi Respon

1. Tambahkan action baru: cari **"Show Notification"**
2. Set teksnya ke sesuatu seperti: `🔓 Pintu berhasil dibuka!`

> **Tip:** Untuk lebih canggih, kamu bisa pakai action **"Get Dictionary Value"** untuk parsing JSON response dan menampilkan pesan dari server.

### Step 7 — Beri Nama & Ikon

1. Tap nama shortcut di atas (default "New Shortcut")
2. Rename jadi **"Buka Pintu"** 🚪
3. Tap ikon untuk mengganti:
   - **Ikon:** Lock / House
   - **Warna:** Hijau atau biru

### Step 8 — Simpan

Tap **Done** di kanan atas. Shortcut siap digunakan!

---

## Bonus: Buat Shortcut "Kunci Pintu"

Ulangi langkah di atas, tapi ganti URL menjadi:

```
https://esp.ilhame.id/api/door/lock
```

Dan beri nama **"Kunci Pintu"** 🔒

---

## Cara Menambahkan ke Home Screen

### Sebagai Widget

1. Di Home Screen, **long press** (tahan) area kosong
2. Tap **+** di kiri atas
3. Cari **Shortcuts**
4. Pilih ukuran widget (Small = 1 shortcut, Medium = 4 shortcut)
5. Tap **Add Widget**
6. Tap widget → pilih shortcut **"Buka Pintu"**

### Sebagai Ikon di Home Screen

1. Buka app **Shortcuts**
2. Tap **⋯** (titik tiga) di shortcut "Buka Pintu"
3. Tap ikon **ⓘ** atau **Share** di bagian bawah
4. Pilih **Add to Home Screen**
5. Kamu bisa custom ikon dan namanya
6. Tap **Add**

Sekarang kamu punya tombol di Home Screen yang langsung buka pintu! 🎉

---

## Cara Menggunakan via Siri

Setelah membuat shortcut, kamu bisa langsung bilang:

> **"Hey Siri, Buka Pintu"**

Siri akan otomatis menjalankan shortcut tersebut. Nama shortcut = perintah Siri.

---

## Cara Menggunakan via Action Button (iPhone 15 Pro / 16)

Jika kamu punya iPhone 15 Pro, 16, atau yang lebih baru:

1. Buka **Settings** → **Action Button** (atau **Tombol Tindakan**)
2. Swipe dan pilih **Shortcut**
3. Tap dan pilih shortcut **"Buka Pintu"**

Sekarang cukup tekan dan tahan Action Button untuk membuka pintu!

---

## Cara Menggunakan via Control Center (iOS 18+)

Mulai iOS 18, kamu bisa menambahkan shortcut ke Control Center:

1. Swipe turun dari pojok kanan atas untuk buka **Control Center**
2. Tap **+** (tombol tambah) di pojok kiri atas, atau **long press** area kosong
3. Tap **Add a Control** di bagian bawah
4. Cari dan pilih **Shortcuts**
5. Pilih shortcut **"Buka Pintu"**
6. Tap area kosong untuk selesai

Sekarang kamu bisa akses cepat dari Control Center!

---

## Shortcut Lanjutan: Dengan Konfirmasi

Untuk mencegah tidak sengaja membuka pintu, buat shortcut dengan dialog konfirmasi:

### Langkah:

1. **Add Action:** Cari **"Show Alert"**
   - Title: `Buka Pintu?`
   - Message: `Apakah kamu yakin ingin membuka pintu?`
   - Show Cancel Button: **ON**

2. **Add Action:** Cari **"Get Contents of URL"**
   - URL: `https://esp.ilhame.id/api/door/unlock`
   - Method: `POST`
   - Header: `X-API-Key` = `<your-api-key>`

3. **Add Action:** Cari **"Show Notification"**
   - Text: `🔓 Pintu dibuka!`

Jika user tap **Cancel**, shortcut berhenti. Jika tap **OK**, pintu terbuka.

---

## Shortcut Lanjutan: Toggle (Buka/Kunci)

Satu shortcut untuk toggle status pintu:

### Langkah:

1. **Add Action:** "Get Contents of URL"
   - URL: `https://esp.ilhame.id/api/status`
   - Method: `GET`
   - Header: `X-API-Key` = `<your-api-key>`

2. **Add Action:** "Get Dictionary Value"
   - Get value for key: `doorLocked`

3. **Add Action:** "If"
   - Condition: **is** `1` (pintu terkunci → buka)

4. Di dalam **If:**
   - "Get Contents of URL" → `POST https://esp.ilhame.id/api/door/unlock`
   - Header: `X-API-Key` = `<your-api-key>`
   - "Show Notification" → `🔓 Pintu dibuka!`

5. Di dalam **Otherwise:**
   - "Get Contents of URL" → `POST https://esp.ilhame.id/api/door/lock`
   - Header: `X-API-Key` = `<your-api-key>`
   - "Show Notification" → `🔒 Pintu dikunci!`

6. **End If**

---

## Automasi: Buka Pintu Otomatis

### Berdasarkan Lokasi (NFC/Geofence)

1. Buka app **Shortcuts** → tab **Automation**
2. Tap **+** → **Create Personal Automation**
3. Pilih **Arrive** (tiba di lokasi)
4. Set lokasi rumah kamu dan radius
5. Tambahkan action "Get Contents of URL" dengan konfigurasi unlock seperti di atas
6. Opsional: matikan **"Ask Before Running"** untuk full otomatis

### Berdasarkan NFC Tag

1. **Automation** → **+** → **NFC**
2. Scan NFC tag yang kamu tempel di pintu
3. Tambahkan action unlock seperti di atas
4. Matikan **"Ask Before Running"**

Sekarang cukup tap iPhone ke NFC tag untuk buka pintu!

---

## Apple Watch

Shortcut yang sudah dibuat otomatis tersedia di Apple Watch:

1. Di Apple Watch, buka app **Shortcuts**
2. Tap **"Buka Pintu"**
3. Done! Pintu terbuka dari pergelangan tangan 🎉

Atau tambahkan sebagai **complication** di watch face untuk akses 1-tap.

---

## Troubleshooting

| Masalah                          | Solusi                                                                     |
| -------------------------------- | -------------------------------------------------------------------------- |
| Error "Could not connect"        | Pastikan ESP32 online dan URL benar                                        |
| Response error / 401             | Cek API Key deployment Anda (`X-API-Key: <your-api-key>`)                   |
| Shortcut tidak muncul di Siri    | Pastikan nama shortcut unik dan tidak ada karakter khusus                  |
| Tidak bisa dari luar rumah       | Pastikan ESP32 bisa diakses dari internet (via domain `esp.ilhame.id`)     |
| Timeout / lambat                 | Cek koneksi WiFi ESP32 dan koneksi internet iPhone                         |
| Action Button tidak ada          | Fitur ini hanya tersedia di iPhone 15 Pro / 16 ke atas                     |
| Control Center shortcut tidak ada| Fitur ini membutuhkan iOS 18 atau lebih baru                               |

---

## Keamanan

> ⚠️ **Perhatian:** API Key disimpan langsung di Shortcut. Siapapun yang punya akses ke iPhone / Shortcut kamu bisa membuka pintu.

**Rekomendasi:**

1. **Aktifkan Face ID / Touch ID** untuk iPhone
2. **Gunakan shortcut dengan konfirmasi** (Show Alert) untuk mencegah akses tidak sengaja
3. **Jangan share** shortcut ke orang lain (API Key akan ikut terbawa)
4. **Ganti API Key** secara berkala di ESP32 config dan update di Shortcut
5. **Gunakan HTTPS** (sudah ✅ — `https://esp.ilhame.id`)

---

## Quick Test via Terminal

Sebelum membuat shortcut, test dulu API-nya:

```bash
# Buka pintu
curl -X POST https://esp.ilhame.id/api/door/unlock \
  -H "X-API-Key: <your-api-key>"

# Kunci pintu
curl -X POST https://esp.ilhame.id/api/door/lock \
  -H "X-API-Key: <your-api-key>"

# Cek status
curl -H "X-API-Key: <your-api-key>" \
  https://esp.ilhame.id/api/status
```

Jika response `{"success": true}`, API berjalan dengan baik dan siap digunakan di Shortcut! ✅
