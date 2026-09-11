# API Logging untuk ESP32 Smart Door Lock

## Setup

### 1. Konfigurasi .env.local

File `.env.local` sudah dibuat dengan konfigurasi berikut:

```env
# ESP32 API Configuration
ESP32_API_KEY=<set-in-private-env>

# ESP32 Default Configuration
NEXT_PUBLIC_ESP32_IP=10.10.1.5
NEXT_PUBLIC_ESP32_PORT=80
NEXT_PUBLIC_WS_PORT=81
```

⚠️ **Penting**: File `.env.local` tidak di-commit ke Git. Gunakan `.env.example` sebagai template.

### 2. API Endpoints untuk ESP32

ESP32 dapat mengirim log ke server Next.js menggunakan endpoint berikut:

#### POST /api/logs
Mengirim access log dari ESP32 ke server.

**Headers:**
```
Content-Type: application/json
X-API-Key: <your-api-key>
```

**Body:**
```json
{
  "cardUid": "BE:02:28:DB",
  "cardNickname": "Card Name",
  "action": "unlock",
  "success": true
}
```

**Response:**
```json
{
  "success": true,
  "log": {
    "id": "1234567890-abc123",
    "timestamp": "2026-02-06T10:30:00.000Z",
    "cardUid": "BE:02:28:DB",
    "cardNickname": "Card Name",
    "action": "unlock",
    "success": true
  }
}
```

#### GET /api/logs
Mendapatkan semua access logs (untuk web dashboard).

**Response:**
```json
[
  {
    "id": "1234567890-abc123",
    "timestamp": "2026-02-06T10:30:00.000Z",
    "cardUid": "BE:02:28:DB",
    "cardNickname": "Card Name",
    "action": "unlock",
    "success": true
  }
]
```

#### POST /api/cards
Menambah kartu baru.

**Headers:**
```
Content-Type: application/json
X-API-Key: <your-api-key>
```

**Body:**
```json
{
  "uid": "BE:02:28:DB",
  "nickname": "Card Name"
}
```

#### GET /api/cards
Mendapatkan semua kartu yang terdaftar.

#### DELETE /api/cards/:uid
Menghapus kartu berdasarkan UID.

#### PUT /api/cards/:uid
Update informasi kartu (nickname, lastUsed, dll).

### 3. Data Storage

Data disimpan sementara di direktori `data/` dalam format JSON:

- `data/logs.json` - Access logs dari ESP32
- `data/cards.json` - Daftar kartu yang terdaftar

⚠️ **Note**: Ini adalah solusi sementara untuk testing. Nantinya akan menggunakan database.

### 4. Konfigurasi ESP32

Di file `config.h` ESP32, tambahkan konfigurasi berikut:

```cpp
// Web Server Logging
#define WEB_SERVER_IP       "10.10.1.xxx"    // IP komputer yang menjalankan Next.js
#define WEB_SERVER_PORT     3000              // Port Next.js (default: 3000)
#define WEB_API_KEY         "<your-api-key>"
#define WEB_API_ENDPOINT    "/api/logs"
```

Di `APIHandler.cpp`, kirim log ke server:

```cpp
void APIHandler::sendLogToServer(const char* cardUid, const char* action, bool success) {
    HTTPClient http;
    String url = String("http://") + WEB_SERVER_IP + ":" + String(WEB_SERVER_PORT) + WEB_API_ENDPOINT;
    
    http.begin(url);
    http.addHeader("Content-Type", "application/json");
    http.addHeader("X-API-Key", WEB_API_KEY);
    
    String payload = "{";
    payload += "\"cardUid\":\"" + String(cardUid) + "\",";
    payload += "\"action\":\"" + String(action) + "\",";
    payload += "\"success\":" + String(success ? "true" : "false");
    payload += "}";
    
    int httpCode = http.POST(payload);
    
    if (httpCode > 0) {
        DEBUG_PRINTF("[API] Log sent, code: %d\n", httpCode);
    } else {
        DEBUG_PRINTF("[API] Error sending log: %s\n", http.errorToString(httpCode).c_str());
    }
    
    http.end();
}
```

### 5. Testing

1. Jalankan Next.js dev server:
   ```bash
   cd smart-door-web
   npm run dev
   ```

2. Server akan berjalan di `http://localhost:3000`

3. ESP32 dapat mengirim log ke `http://<IP_KOMPUTER>:3000/api/logs`

4. Gunakan Postman atau curl untuk testing:
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

### 6. Monitoring

- Access logs dapat dilihat di dashboard web: `http://localhost:3000/logs`
- File JSON dapat dilihat langsung di `data/logs.json`
- Console log di terminal Next.js akan menampilkan request yang masuk

### 7. Migration ke Database (Nanti)

Struktur data sudah siap untuk migrasi ke database:
- PostgreSQL
- MySQL
- MongoDB
- Supabase
- dll

File `serverStorage.ts` dapat diganti dengan database client tanpa mengubah API endpoints.
