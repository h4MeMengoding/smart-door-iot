# 📘 BRIEF SISTEM DATABASE  
## IoT Smart Door Lock – Single Door  

> Dokumen ini menjadi acuan implementasi **database** untuk sistem IoT Smart Door Lock  
> Sistem realtime **SUDAH ADA**, database ditambahkan **tanpa mengganggu alur realtime**.

---

## 1. Konteks Sistem Saat Ini

Sistem yang sudah berjalan:
- ESP32 (RFID + kontrol pintu)
- Web dashboard berbasis **Next.js**
- Komunikasi **ESP32 ⇄ API Next.js**
- Status pintu realtime
- Sistem **1 pintu (single door)**

Yang belum ada:
- Database
- Histori akses permanen
- Pemetaan UID RFID → identitas manusia

---

## 2. Tujuan Database

Database digunakan untuk:
1. Menyimpan histori akses pintu
2. Memetakan UID RFID ke nama pengguna
3. Audit & monitoring jangka panjang

Database **TIDAK BOLEH**:
- Mengontrol logic buka/tutup pintu
- Menjadi sumber status realtime

---

## 3. Prinsip Arsitektur (WAJIB)

**Realtime ≠ Database**

- Realtime: ESP32 ⇄ API ⇄ WebSocket / SSE
- Database: logging & metadata
- Dashboard:
  - Status pintu → realtime API
  - Histori & user → database

Jika database down:
- Sistem pintu tetap berfungsi
- Histori boleh gagal tersimpan

---

## 4. Database

- PostgreSQL (Aiven.io)
- Diakses melalui backend Next.js (API layer)
- ORM / query builder bebas

---

## 5. Konsep Identitas Pengguna

- ESP32 hanya mengenal **UID RFID**
- Nama **tidak wajib ada saat UID pertama muncul**
- UID adalah identitas utama (immutable)
- Nama adalah metadata (editable)

---

## 6. Struktur Database

### 6.1 Tabel: `rfid_cards`

Menyimpan kartu RFID yang pernah digunakan.

| Field | Tipe | Keterangan |
|------|------|------------|
| id | UUID / SERIAL | Primary key |
| uid | VARCHAR | UID RFID (unik) |
| display_name | VARCHAR | Nama user (nullable / default) |
| is_named | BOOLEAN | Apakah sudah diberi nama |
| created_at | TIMESTAMP | Pertama kali terdeteksi |
| updated_at | TIMESTAMP | Update terakhir |

Catatan:
- UID pertama kali muncul → auto insert
- `display_name` default: "Unknown User"
- Nama bisa diubah kapan saja via dashboard

---

### 6.2 Tabel: `access_logs`

Histori akses pintu.

| Field | Tipe | Keterangan |
|------|------|------------|
| id | UUID / SERIAL | Primary key |
| uid | VARCHAR | UID RFID |
| access_type | VARCHAR | RFID / Touch / Remote |
| access_result | VARCHAR | granted / denied |
| created_at | TIMESTAMP | Waktu kejadian |

Catatan:
- Append-only
- Tidak boleh diedit / dihapus manual

---

### 6.3 (Opsional) `system_events`

Event sistem non-user.

| Field | Keterangan |
|------|-----------|
| event_type | boot / reboot / error |
| description | Deskripsi |
| created_at | Timestamp |

---

## 7. Alur Data

### 7.1 Akses RFID

RFID Tap  
→ ESP32 baca UID  
→ ESP32 validasi lokal  
→ ESP32 kirim event ke API  
→ API:
- insert `access_logs`
- cek `rfid_cards`
- jika UID belum ada → insert UID baru

---

### 7.2 Penamaan UID di Dashboard

Admin buka dashboard  
→ lihat UID tanpa nama  
→ input nama  
→ update `rfid_cards.display_name`  

⚠️ Nama hanya untuk dashboard  
⚠️ ESP32 tidak perlu tahu nama

---

## 8. Pembagian Tanggung Jawab

### ESP32
- Autentikasi RFID
- Kontrol pintu
- Kirim event

### API (Next.js)
- Terima event
- Simpan ke database
- Query histori

### Database
- Simpan UID & histori
- Tidak ikut logic pintu

### Dashboard
- Realtime status pintu
- Histori akses
- Rename UID → nama

---

## 9. Constraint Penting

1. UID RFID tidak pernah berubah
2. Database tidak boleh blocking akses pintu
3. Sistem harus tetap berfungsi tanpa DB
4. Realtime tidak lewat database

---

## 10. Future Scope (Tidak Sekarang)

- Statistik akses
- Export CSV
- Role user
- Notifikasi
- Audit trail

---

## 11. Ringkasan Singkat

> UID adalah identitas utama  
> Nama ditambahkan belakangan  
> Database untuk histori  
> Realtime tetap direct ESP32 ⇄ API  

