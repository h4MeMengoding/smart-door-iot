# 🚪 Smart Door Dashboard API Documentation

Dokumentasi ini berisi daftar endpoint API yang tersedia pada Dashboard Smart Door untuk diintegrasikan ke aplikasi mobile (Flutter). API ini diekspos melalui domain utama.

## 🌐 Base URL
```
https://iot.ilhame.id
```

---

## 🔐 Authentication (X-API-Key)

API ini tidak menggunakan sistem login/session, melainkan divalidasi langsung menggunakan **API Key**. Anda harus menyertakan API Key pada **Headers** di setiap HTTP request yang dikirimkan dari aplikasi Flutter.

*   **Header Key:** `X-API-Key`
*   **Header Value:** `<YOUR_API_KEY>`

**Contoh Header pada HTTP Request:**
```json
{
  "X-API-Key": "your_secret_api_key_here",
  "Content-Type": "application/json"
}
```

---

## 🛠 Endpoints

### 1. Door Control (`/api/door`)

#### **Get Door Status**
Mendapatkan status pintu saat ini.
*   **URL:** `GET /api/door`
*   **Response:**
    ```json
    {
      "success": true,
      "doorUnlocked": false,
      "doorStatus": "LOCKED",
      "deviceOnline": true,
      "lastEvent": "Door locked",
      "uptime": "12345s"
    }
    ```

#### **Lock/Unlock Door**
Mengirim perintah buka atau kunci pintu.
*   **URL:** `POST /api/door`
*   **Body:**
    ```json
    { "action": "unlock" } // atau "lock"
    ```
*   **Response:**
    ```json
    { "success": true, "message": "Command sent" }
    ```

---

### 2. Card Management (`/api/cards`)

#### **Get All Cards**
Mengambil daftar kartu RFID yang terdaftar di database.
*   **URL:** `GET /api/cards`
*   **Response:**
    ```json
    [
      {
        "uid": "BE:02:28:DB",
        "nickname": "Hame",
        "addedAt": "2024-04-27T10:00:00Z",
        "isNamed": true
      }
    ]
    ```

#### **Add Card**
Mendaftarkan kartu baru ke database.
*   **URL:** `POST /api/cards`
*   **Body:**
    ```json
    { "uid": "AA:BB:CC:DD", "nickname": "Tamu" }
    ```

#### **Update Card**
Mengubah nama/nickname kartu.
*   **URL:** `PUT /api/cards`
*   **Body:**
    ```json
    { "uid": "AA:BB:CC:DD", "nickname": "Nama Baru" }
    ```

#### **Delete Card**
Menghapus kartu dari database.
*   **URL:** `DELETE /api/cards`
*   **Body:**
    ```json
    { "uid": "AA:BB:CC:DD" }
    ```

---

### 3. Access Logs (`/api/logs`)

#### **Get Logs**
Mengambil riwayat akses pintu. Mendukung pagination dan polling.
*   **URL:** `GET /api/logs`
*   **Query Params:**
    *   `limit`: Jumlah data (default 200)
    *   `offset`: Skip data
    *   `since`: ISO Timestamp (untuk polling data terbaru saja)
*   **Response:**
    ```json
    {
      "logs": [
        {
          "id": "cl...",
          "timestamp": "2024-04-27T12:00:00Z",
          "cardUid": "BE:02:28:DB",
          "cardNickname": "Hame",
          "action": "unlock",
          "success": true,
          "accessType": "RFID"
        }
      ],
      "totalCount": 150
    }
    ```

---

### 4. System Config (`/api/config`)

#### **Get Config**
Mendapatkan konfigurasi sistem (auto-lock, delay kartu, dan jadwal).
*   **URL:** `GET /api/config`
*   **Response:**
    ```json
    {
      "autoLockDuration": 5,
      "cardDelays": [],
      "cardSchedules": []
    }
    ```

#### **Update Config**
Memperbarui konfigurasi pintu (contoh mengubah durasi auto-lock ke 10 detik).
*   **URL:** `PUT /api/config`
*   **Body:**
    ```json
    { "autoLockDuration": 10 }
    ```

---

### 5. Generic ESP Command (`/api/esp`)

Mengirimkan berbagai perintah tambahan langsung ke ESP32 secara dinamis.
*   **URL:** `POST /api/esp`
*   **Body:**
    ```json
    {
      "command": "system.buzzer",
      "pattern": "VALID_CARD"
    }
    ```
*   **Daftar Command yang didukung:**
    *   `door.unlock` / `door.lock`
    *   `system.restart`
    *   `system.info`
    *   `cards.list` / `cards.sync`
    *   `rfid.toggle`

---

### 6. Environment & System Info

#### **Get Weather**
Mendapatkan info cuaca di area perangkat IoT (opsional untuk dashboard).
*   **URL:** `GET /api/weather`

#### **Get System Events**
Mendapatkan log status sistem (restarts, errors, OTA).
*   **URL:** `GET /api/system-events`

---

## ⚠️ Error Handling

Format balasan error standar jika validasi gagal atau server error:
```json
{
  "success": false,
  "message": "Deskripsi kesalahan di sini"
}
```

**Status Codes Utama:**
*   `200`: Sukses
*   `400`: Bad Request (kesalahan parameter body/query)
*   `401`: Unauthorized (API Key salah atau tidak ada)
*   `403`: Forbidden (Akses ditolak)
*   `500`: Internal Server Error

---

## 📱 Tips Integrasi Flutter

1.  **Gunakan Interceptor (Dio):** Jangan memasukkan header `X-API-Key` di setiap request secara manual. Jika menggunakan package `dio`, buatlah interceptor untuk menyisipkan header ini secara otomatis di semua request.
    ```dart
    dio.interceptors.add(InterceptorsWrapper(
      onRequest: (options, handler) {
        options.headers['X-API-Key'] = 'YOUR_API_KEY';
        return handler.next(options);
      },
    ));
    ```
2.  **Hindari SSE/WebSockets yang Berat:** Mengingat arsitektur backend, disarankan melakukan **Incremental Polling** pada endpoint `/api/logs?since=<timestamp_terakhir>` setiap 3-5 detik jika Anda membutuhkan update data realtime (dibandingkan membuka koneksi WebSocket terus menerus).
3.  **Konektivitas Device:** Pada response `/api/door`, selalu perhatikan key `deviceOnline`. Jika `false`, ESP32 sedang offline atau terputus dari MQTT broker, sehingga command unlock/lock kemungkinan besar tidak akan berjalan.

---
**Last Updated:** April 2026
