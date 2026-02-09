# Data Directory

Direktori ini menyimpan data sementara dalam format JSON untuk testing.

## Files:
- `logs.json` - Access logs dari ESP32
- `cards.json` - Daftar kartu yang terdaftar

⚠️ **Note**: Ini adalah solusi sementara. Nantinya akan menggunakan database.

## Struktur logs.json:
```json
[
  {
    "id": "unique-id",
    "timestamp": "2026-02-06T10:30:00.000Z",
    "cardUid": "BE:02:28:DB",
    "cardNickname": "Card Name",
    "action": "unlock",
    "success": true
  }
]
```

## Struktur cards.json:
```json
[
  {
    "uid": "BE:02:28:DB",
    "nickname": "Card Name",
    "addedAt": "2026-02-06T10:30:00.000Z",
    "lastUsed": "2026-02-06T10:30:00.000Z"
  }
]
```
