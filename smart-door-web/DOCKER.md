# Docker Hosting Guide

Dashboard Smart Door Lock sudah dikonfigurasi untuk environment Docker. Anda bisa langsung menjalankan aplikasi menggunakan Docker Compose.

## Persiapan

1. Pastikan **Docker** dan **Docker Compose** sudah terinstall di server/komputer Anda.
2. Clone repository ini dan masuk ke folder `smart-door-web`.
3. Buat file `.env` di dalam folder `smart-door-web` berdasarkan `.env.example` atau dari setup yang ada. Pastikan kredensial seperti di bawah ini sudah terisi:

```env
DATABASE_URL="postgres://user:password@host/dbname"
NEXT_PUBLIC_ESP32_URL="http://192.168.x.x"
ESP32_API_KEY="rahasia123"
AUTH_SECRET="kunci-rahasia-minimal-32-karakter"
SECURE_COOKIES=true
MQTT_BROKER_URL="mqtts://broker.example.com:8883"
MQTT_USERNAME="smartdoor-server"
MQTT_PASSWORD="rahasia-mqtt-server"
NEXT_PUBLIC_MQTT_WS_URL="wss://broker.example.com:8084/mqtt"
NEXT_PUBLIC_MQTT_WS_USERNAME="smartdoor-web-readonly"
NEXT_PUBLIC_MQTT_WS_PASSWORD="rahasia-mqtt-readonly"
NEXT_PUBLIC_VAPID_PUBLIC_KEY="..."
VAPID_PRIVATE_KEY="..."
```

## Menjalankan Aplikasi

Untuk build dan menjalankan kontainer dalam mode background (daemon), jalankan perintah:

```bash
docker compose up -d --build
```

Setelah proses selesai:
- Dashboard bisa diakses pada `http://localhost:3100` (atau IP server Anda).
- Untuk melihat log dari aplikasi, gunakan: `docker compose logs -f`
- Untuk mematikan layanan, gunakan: `docker compose down`

## Pembaruan Skema Database (Prisma)

Karena aplikasi berjalan terisolasi di dalam Docker, jika Anda ingin menjalankan migrasi database atau push skema baru:

1. Modifikasi skema di `prisma/schema.prisma`
2. Push skema ke database, dari luar Docker (perlu NodeJS)
   ```bash
   npm run db:push
   ```
   Atau dari dalam docker jika tidak memiliki nodejs:
   ```bash
   docker compose exec web npx prisma db push
   ```
3. Build ulang docker image:
   ```bash
   docker compose up -d --build
   ```

## Catatan
- Karena `next.config.ts` sudah dikonfigurasikan dengan `output: "standalone"`, ukuran image Docker akan jauh lebih kecil dan optimal untuk produksi.
- Secara default aplikasi mem-publish port `3100`. Jika Anda ingin mengubah port publish, edit `docker-compose.yml` pada bagian `ports: - "3100:3000"`.
