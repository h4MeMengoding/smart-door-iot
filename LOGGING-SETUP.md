# ESP32 Smart Door Lock - Setup Logging ke Web Server

## ✅ Yang Sudah Dikonfigurasi

### 1. Web Server (Next.js)

File-file berikut sudah dibuat:

- **`.env.local`** - Konfigurasi API key (tidak di-commit ke Git)
- **`.env.example`** - Template untuk `.env.local`
- **`data/`** - Direktori untuk menyimpan JSON files
  - `logs.json` - Access logs dari ESP32
  - `cards.json` - Daftar kartu terdaftar
  - `README.md` - Dokumentasi struktur data

- **API Routes:**
  - `POST /api/logs` - Terima log dari ESP32
  - `GET /api/logs` - Ambil semua logs
  - `DELETE /api/logs/clear` - Hapus semua logs
  - `POST /api/cards` - Tambah kartu baru
  - `GET /api/cards` - Ambil semua kartu
  - `DELETE /api/cards/:uid` - Hapus kartu
  - `PUT /api/cards/:uid` - Update kartu

- **Server Utilities:**
  - `lib/serverStorage.ts` - File I/O untuk logs dan cards
  
- **Hooks:**
  - `hooks/useServerLogs.ts` - Hook untuk fetch logs dari API

- **Updated Pages:**
  - `app/logs/page.tsx` - Menampilkan logs dari server (auto-refresh 5 detik)

### 2. Dokumentasi

- **`smart-door-web/API-LOGGING.md`** - Dokumentasi lengkap API endpoints
- **`smart-door-iot/ESP32-WEB-LOGGING.md`** - Contoh kode untuk ESP32

### 3. Testing

Script testing sudah tersedia:
```bash
cd smart-door-web
./test-api.sh
```

## 🚀 Cara Menggunakan

### Step 1: Jalankan Web Server

```bash
cd smart-door-web
npm install  # jika belum
npm run dev
```

Server akan berjalan di `http://localhost:3000`

### Step 2: Test API (Optional)

```bash
# Di terminal lain
cd smart-door-web
./test-api.sh
```

Atau manual dengan curl:
```bash
curl -X POST http://localhost:3000/api/logs \
  -H "Content-Type: application/json" \
  -H "X-API-Key: <your-api-key>" \
  -d '{
    "cardUid": "BE:02:28:DB",
    "action": "unlock",
    "success": true
  }'
```

### Step 3: Lihat Logs di Dashboard

Buka browser: `http://localhost:3000/logs`

Logs akan auto-refresh setiap 5 detik.

### Step 4: Konfigurasi ESP32

1. Baca dokumentasi lengkap di `smart-door-iot/ESP32-WEB-LOGGING.md`

2. Update `config.h`:
   ```cpp
   #define WEB_SERVER_ENABLED  true
   #define WEB_SERVER_IP       "10.10.1.100"  // IP komputer Anda
   #define WEB_SERVER_PORT     3000
   #define WEB_API_KEY         "<your-api-key>"
   ```

3. Implementasi kode dari `ESP32-WEB-LOGGING.md`

4. Upload ke ESP32

## 📁 Struktur File Baru

```
smart-door-web/
├── .env.local              # API key (tidak di-commit)
├── .env.example            # Template env
├── test-api.sh             # Script untuk testing API
├── API-LOGGING.md          # Dokumentasi API
├── data/                   # Data storage (temporary)
│   ├── logs.json          # Access logs
│   ├── cards.json         # Card data
│   └── README.md          # Struktur data
├── app/
│   └── api/
│       ├── logs/
│       │   ├── route.ts   # GET, POST logs
│       │   └── clear/
│       │       └── route.ts  # DELETE logs
│       └── cards/
│           └── route.ts   # CRUD cards
├── lib/
│   └── serverStorage.ts   # File I/O utilities
└── hooks/
    └── useServerLogs.ts   # Fetch logs hook

smart-door-iot/
└── ESP32-WEB-LOGGING.md   # Contoh kode ESP32
```

## 🔐 Keamanan

- **API Key**: Disimpan di `.env.local` (tidak di-commit)
- **X-API-Key header**: Required untuk semua POST/PUT/DELETE requests
- File `.env.local` sudah ada di `.gitignore`

## 📊 Monitoring

1. **Terminal Next.js**: Lihat request yang masuk
2. **Browser Console**: Debug fetch errors
3. **File JSON**: Lihat langsung di `data/logs.json`
4. **Dashboard**: `http://localhost:3000/logs`

## ⚠️ Important Notes

1. **Temporary Solution**: Ini adalah solusi sementara menggunakan JSON files. Nantinya akan menggunakan database.

2. **Network**: ESP32 dan komputer harus di network yang sama.

3. **IP Address**: Ganti `WEB_SERVER_IP` di ESP32 dengan IP komputer Anda:
   ```bash
   ifconfig | grep "inet "
   ```

4. **Firewall**: Pastikan port 3000 tidak diblok firewall.

5. **Auto-refresh**: Dashboard logs auto-refresh setiap 5 detik.

## 🐛 Troubleshooting

### ESP32 tidak bisa kirim log:
- Cek network (ping ESP32 dari komputer)
- Cek IP address di `config.h`
- Cek firewall komputer
- Lihat Serial Monitor ESP32 untuk error

### Error 401 Unauthorized:
- API key tidak cocok
- Restart Next.js server setelah edit `.env.local`

### Data tidak muncul di dashboard:
- Cek browser console untuk errors
- Refresh halaman
- Cek `data/logs.json` apakah ada data

## 🔄 Migration ke Database (Nanti)

Struktur sudah siap untuk migrasi ke:
- PostgreSQL / MySQL
- MongoDB
- Supabase
- Firebase

Hanya perlu ganti isi `serverStorage.ts` tanpa mengubah API routes.

## 📝 API Key di .env.local

```env
ESP32_API_KEY=<set-in-private-env>
NEXT_PUBLIC_ESP32_IP=10.10.1.5
NEXT_PUBLIC_ESP32_PORT=80
NEXT_PUBLIC_WS_PORT=81
```

⚠️ **Ganti `ESP32_API_KEY` dengan key yang lebih secure untuk production!**
