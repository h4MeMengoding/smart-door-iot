# Push Notification Setup

## Ikhtisar

Smart Door Lock menggunakan **Web Push API** (standar W3C) untuk mengirim notifikasi ke perangkat pengguna, bahkan ketika PWA sedang tertutup. Ini penting terutama untuk **iOS** yang tidak mendukung notifikasi dari client-side JavaScript ketika aplikasi tidak aktif.

### Bagaimana Cara Kerjanya?

```
ESP32 → POST /api/logs → Server Next.js → Web Push API → Push Service (FCM/APNs) → Perangkat
```

1. **ESP32** mengirim event akses (RFID tap, unlock, dll) ke `POST /api/logs`
2. **Server Next.js** menyimpan log ke database, lalu mengirim push notification ke semua perangkat yang terdaftar
3. **Push Service** (Google FCM untuk Android/Chrome, Apple APNs untuk iOS) meneruskan notifikasi ke perangkat
4. **Service Worker** di perangkat menerima push event dan menampilkan notifikasi — bahkan jika PWA ditutup

### Mengapa Tidak Cukup dari Client-Side Saja?

Sebelumnya, notifikasi hanya dikirim dari browser melalui MQTT:

```
ESP32 → MQTT → Browser (harus aktif) → showNotification()
```

Masalah: ketika PWA ditutup atau browser di-minimize, koneksi MQTT terputus dan notifikasi tidak sampai. Terutama pada **iOS**, Apple hanya mengizinkan push notification yang dikirim dari **server** melalui Web Push API.

---

## Environment Variables

Tambahkan 3 variabel berikut ke file `.env`:

```env
NEXT_PUBLIC_VAPID_PUBLIC_KEY=<public_key>
VAPID_PRIVATE_KEY=<private_key>
VAPID_SUBJECT=https://domain-anda.com
```

### Cara Generate VAPID Keys

```bash
cd smart-door-web
npx web-push generate-vapid-keys
```

Output:

```
Public Key:  BE6CPu5-bzmYpBX...
Private Key: TzvOua1FQECB4UF...
```

Copy kedua key ke `.env`.

### Penjelasan Tiap Variable

| Variable | Sisi | Penjelasan |
|----------|------|------------|
| `NEXT_PUBLIC_VAPID_PUBLIC_KEY` | Client + Server | Public key untuk mengidentifikasi server Anda ke push service. Prefix `NEXT_PUBLIC_` agar bisa diakses di browser untuk membuat push subscription. |
| `VAPID_PRIVATE_KEY` | Server only | Private key untuk menandatangani push message. **Jangan pernah di-expose ke client.** |
| `VAPID_SUBJECT` | Server only | Identitas server Anda — bisa berupa `https://domain.com` atau `mailto:email@domain.com`. |

### Mengapa Ada VAPID_SUBJECT?

**VAPID_SUBJECT bukan untuk mengirim email.** Ini adalah bagian dari standar **VAPID** (Voluntary Application Server Identification for Web Push) — RFC 8292.

Push service seperti Google FCM dan Apple APNs membutuhkan identitas pengirim agar bisa:
- **Memverifikasi** bahwa push dikirim dari server yang sah
- **Menghubungi** developer jika ada masalah (rate limit, abuse, dll)

Format yang diterima:
- `https://domain-anda.com` — **disarankan**, cukup gunakan URL website Anda
- `mailto:email@domain.com` — alternatif, jika ingin bisa dihubungi via email

**Rekomendasi:** Gunakan URL website Anda saja, contoh:
```env
VAPID_SUBJECT=https://smartdoor.ilhame.id
```

---

## Arsitektur

### File-file Terkait

| File | Fungsi |
|------|--------|
| `lib/webpush.ts` | Server-side: kirim push ke semua subscriber |
| `lib/notifications.ts` | Client-side: subscribe/unsubscribe, permission management |
| `public/sw.js` | Service Worker: terima push event, tampilkan notifikasi |
| `app/api/push/subscribe/route.ts` | API: simpan/hapus push subscription ke database |
| `app/api/logs/route.ts` | Trigger: kirim push saat ESP32 POST access log |
| `prisma/schema.prisma` | Model `PushSubscription` untuk menyimpan subscription |

### Data Flow

```
┌─────────────┐
│    ESP32     │
│  (RFID tap)  │
└──────┬──────┘
       │ POST /api/logs
       ▼
┌──────────────────┐     ┌──────────────────┐
│   Next.js API    │────▶│   PostgreSQL DB   │
│  (logs/route.ts) │     │  (access_logs)    │
└──────┬───────────┘     └──────────────────┘
       │
       │ sendPushToAll()
       ▼
┌──────────────────┐
│  lib/webpush.ts  │
│  (web-push npm)  │
└──────┬───────────┘
       │ HTTPS ke push service
       ▼
┌──────────────────┐     ┌──────────────────┐
│   Push Service   │────▶│  Service Worker   │
│  (FCM / APNs)    │     │  (public/sw.js)   │
└──────────────────┘     └──────┬───────────┘
                                │
                                │ showNotification()
                                ▼
                         ┌──────────────────┐
                         │   Notifikasi OS   │
                         │  (muncul di HP)   │
                         └──────────────────┘
```

### iOS-Compatible Payload

iOS **tidak mendukung** payload format `notification-only`. Harus menggunakan format `data`:

```json
// ❌ SALAH — tidak akan muncul di iOS saat app tertutup
{
  "notification": {
    "title": "Door Opened",
    "body": "RFID Access"
  }
}

// ✅ BENAR — data-only payload, iOS compatible
{
  "data": {
    "type": "door_open",
    "title": "Door Opened",
    "body": "RFID Access",
    "tag": "access-granted-123",
    "url": "/",
    "timestamp": "2026-03-01T12:00:00Z"
  }
}
```

Service Worker kemudian memanggil `showNotification()` secara manual di dalam event handler `push`.

---

## Service Worker Cache Policy

Cache di service worker **tidak mengganggu** data real-time. Berikut kebijakan cache:

| Request Type | Strategi | Alasan |
|-------------|----------|--------|
| `/api/*` (semua API) | **TIDAK DI-CACHE** | Data harus selalu real-time dari server |
| MQTT WebSocket (`wss://`) | **TIDAK DI-INTERCEPT** | Beda origin, SW tidak bisa intercept |
| Navigasi (HTML pages) | **TIDAK DI-CACHE** | Selalu fetch dari network agar React bundle terbaru |
| `/_next/static/*` | Cache-first | File JS/CSS dengan content hash — immutable per build |
| `/favicon/*` | Cache-first | Icon statis, jarang berubah |
| Lainnya | **TIDAK DI-CACHE** | Pass-through ke network |

**Jaminan: Semua data dari MQTT dan API selalu real-time, tidak pernah dari cache.**

---

## Cara Kerja Push Subscription

1. User membuka Settings → klik "Enable Notifications"
2. Browser meminta izin notifikasi 
3. Jika diizinkan, client memanggil `subscribeToPush()`:
   - Mengambil VAPID public key dari `GET /api/push/subscribe`
   - Membuat `PushSubscription` via `pushManager.subscribe()`
   - Mengirim subscription ke `POST /api/push/subscribe` → disimpan di database
4. Saat ESP32 POST log baru, server memanggil `sendPushToAll()`:
   - Mengambil semua subscription dari database
   - Mengirim push ke setiap subscription via `web-push` library
   - Subscription yang expired (404/410) otomatis dihapus

### Auto-Subscribe

Jika user sudah pernah memberikan izin notifikasi, AppShell akan otomatis re-subscribe saat app dibuka (untuk memastikan subscription tidak expired).

---

## Troubleshooting

### Push tidak masuk di iOS
1. Pastikan env `NEXT_PUBLIC_VAPID_PUBLIC_KEY` dan `VAPID_PRIVATE_KEY` sudah diset
2. Pastikan PWA sudah di-install (Add to Home Screen), bukan dibuka di Safari biasa
3. iOS 16.4+ diperlukan untuk Web Push di PWA
4. Cek Settings → Notifications → Door Lock → pastikan enabled

### Push tidak masuk di Android
1. Buka Settings di app → pastikan "Notifications enabled" muncul hijau
2. Pastikan tidak dalam mode Do Not Disturb
3. Cek Chrome → Settings → Site settings → Notifications

### Subscription tidak tersimpan
Cek database: `SELECT * FROM push_subscriptions;`
Atau via Prisma Studio: `npm run db:studio`
