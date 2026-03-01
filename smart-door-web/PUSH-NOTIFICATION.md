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

Cache di service worker **SANGAT MINIMAL** dan **tidak mengganggu** data real-time. Satu-satunya hal yang di-cache adalah `/_next/static/*` (file JS/CSS dengan content hash yang immutable).

| Request Type | Strategi | Alasan |
|-------------|----------|--------|
| `/api/*` (semua API) | **TIDAK DI-INTERCEPT** | Data harus selalu real-time dari server |
| MQTT WebSocket (`wss://`) | **TIDAK DI-INTERCEPT** | Beda origin |
| Navigasi (HTML pages) | **TIDAK DI-INTERCEPT** | Selalu fresh dari network |
| Manifest (`.webmanifest`) | **TIDAK DI-INTERCEPT** | Chrome harus bisa akses langsung untuk PWA |
| `/favicon/*` | **TIDAK DI-INTERCEPT** | Biarkan network (Cloudflare Access compatible) |
| `/_next/static/*` | Cache-first | Satu-satunya yang di-cache. Filename memiliki content hash, aman di-cache selamanya |
| Lainnya | **TIDAK DI-INTERCEPT** | Pass-through ke network |

**Jaminan: Semua data dari MQTT dan API selalu real-time, tidak pernah dari cache.**

---

## Cloudflare Access (Zero Trust) — PENTING

Jika menggunakan **Cloudflare Tunnel + Cloudflare Access**, ada path-path yang **HARUS di-bypass** agar PWA dan Push Notification berfungsi. Cloudflare Access secara default memproteksi semua request, termasuk manifest dan service worker.

### Path yang HARUS Di-Bypass

Buat **Bypass policy** di Cloudflare Zero Trust Dashboard:

1. Buka **Cloudflare Zero Trust** → **Access** → **Applications**
2. Pilih aplikasi `iot.ilhame.id` (atau buat policy baru)
3. Tambahkan **Bypass** rule untuk path berikut:

| Path Pattern | Alasan |
|-------------|--------|
| `/favicon/*` | Manifest + icon harus bisa diakses Chrome untuk PWA installability |
| `/sw.js` | Service Worker harus bisa di-register tanpa redirect |
| `/api/push/*` | Push subscription endpoint (opsional, biasanya sudah ada cookie CF) |

### Cara Membuat Bypass Policy

```
Zero Trust Dashboard → Access → Applications → [Your App]
→ Add a policy:
   - Policy name: "PWA Static Assets"
   - Action: Bypass
   - Selector: Path
   - Value: /favicon/* , /sw.js
```

Atau gunakan **Service Token** untuk akses internal jika lebih kompleks.

### Kenapa Ini Penting?

Tanpa bypass:
- Chrome fetch `site.webmanifest` → Cloudflare redirect ke login page → **CORS error** → Chrome tidak bisa baca manifest → **PWA tidak bisa di-install** (hanya "Add to Home Screen")
- Service Worker fetch icon saat install → redirect → error → **SW install gagal**
- `beforeinstallprompt` event **tidak pernah fire** → tombol Install tidak muncul

Dengan bypass:
- Chrome bisa baca manifest langsung → PWA criteria terpenuhi → **install prompt muncul** → install sebagai proper PWA di Android
- Service Worker bisa register dan activate tanpa masalah
- Push notification subscription bisa berjalan

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

## Debug / Test

### Cek Push Subscription di Database

```bash
# Via API
curl https://iot.ilhame.id/api/push/test

# Via Prisma Studio
cd smart-door-web && npm run db:studio
```

### Kirim Test Push

```bash
curl -X POST https://iot.ilhame.id/api/push/test
```

### Cek Console di Browser

Buka DevTools → Console, cari log dengan prefix `[Push]`:
- `[Push] Subscribed successfully` → berhasil
- `[Push] Failed to fetch VAPID key:` → VAPID env belum diset
- `[Push] VAPID not configured on server` → env belum diset
- `[Push] Failed to save subscription:` → API endpoint bermasalah (cek CF Access)
- `[Push] Subscription failed:` → browser/OS menolak push subscription

---

## Troubleshooting

### PWA tidak bisa di-install di Android (hanya "Add to Home Screen")
1. **Paling umum**: Cloudflare Access memblokir manifest. Lihat section Cloudflare Access di atas.
2. Cek Console: jika ada error `net::ERR_FAILED` untuk `site.webmanifest` → ini pasti CF Access
3. Pastikan manifest di-link dengan benar: `<link rel="manifest" href="/favicon/site.webmanifest">`
4. Pastikan manifest memiliki `name`, `icons` (192+512px), `start_url`, `display: standalone`

### Push subscription tidak tersimpan (database kosong)
1. Buka Console, cari `[Push]` log — ini akan menunjukkan di step mana yang gagal
2. Buka Settings di app → jika "Push not registered" muncul kuning → klik "Register Push Subscription"
3. Cek `GET /api/push/test` untuk melihat isi tabel subscription
4. Jika `subscribeToPush()` tidak terlog di console → service worker belum aktif

### Push tidak masuk di iOS saat app ditutup
1. Pastikan env `NEXT_PUBLIC_VAPID_PUBLIC_KEY` dan `VAPID_PRIVATE_KEY` sudah diset
2. Pastikan PWA sudah di-install (Add to Home Screen), bukan dibuka di Safari biasa
3. iOS 16.4+ diperlukan untuk Web Push di PWA
4. Cek Settings → Notifications → Door Lock → pastikan enabled
5. Pastikan ada subscription di database: `GET /api/push/test`

### Push tidak masuk di Android
1. Buka Settings di app → pastikan "Notifications enabled" muncul hijau
2. Pastikan "Push notifications active" muncul (bukan "Push not registered")
3. Pastikan tidak dalam mode Do Not Disturb
4. Kirim test: `POST /api/push/test` → harusnya muncul notifikasi
