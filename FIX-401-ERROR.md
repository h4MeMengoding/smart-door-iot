# Quick Fix untuk Error 401 Unauthorized

## Masalah
Dashboard web mencoba connect ke ESP32 tapi mendapat error 401 karena API key belum di-set di localStorage browser.

## Solusi yang Sudah Diterapkan

### 1. Auto-set Default API Key
File [lib/config.ts](smart-door-web/lib/config.ts) sudah diupdate untuk otomatis set default API key jika belum ada di localStorage:

```typescript
export const DEFAULT_API_KEY = process.env.NEXT_PUBLIC_DEFAULT_API_KEY || '';

export function getApiKey(): string {
  if (typeof window === 'undefined') return DEFAULT_API_KEY;
  
  const storedKey = localStorage.getItem(API_KEY_STORAGE_KEY);
  
  // Auto-set default if not exists
  if (!storedKey) {
    localStorage.setItem(API_KEY_STORAGE_KEY, DEFAULT_API_KEY);
    return DEFAULT_API_KEY;
  }
  
  return storedKey;
}
```

### 2. Environment Variable
File `.env.local` sudah ditambahkan:
```env
NEXT_PUBLIC_DEFAULT_API_KEY=<set-in-local-env-only>
```

### 3. Test Connection Feature
Settings page sudah ditambahkan tombol "Test Connection" untuk verify koneksi ke ESP32.

## Cara Menggunakan

### Option 1: Restart Server (Recommended)
```bash
# Stop server (Ctrl+C)
# Lalu jalankan lagi
npm run dev
```

Refresh browser, API key akan otomatis di-set.

### Option 2: Manual Set API Key di Browser Console
Buka browser console (F12) dan jalankan:
```javascript
localStorage.setItem('esp32_api_key', '<your-api-key>');
location.reload();
```

### Option 3: Via Settings Page
1. Buka `http://localhost:3000/settings`
2. Input your API key from the private deployment secret store
3. Klik "Save"
4. Test connection dengan tombol "Test Connection"

## Catatan Penting

⚠️ **ESP32 Harus Menyala dan Connected**

Karena sekarang web app mencoba connect ke ESP32 di `10.10.1.5`, error 401 akan tetap muncul jika:
- ESP32 tidak menyala
- ESP32 tidak di network yang sama
- API key tidak cocok dengan yang di ESP32 config.h

### Untuk Testing Tanpa ESP32

Jika ingin test web app tanpa ESP32 menyala, kita perlu:
1. Mock data mode
2. Atau disable koneksi ke ESP32

Beri tahu jika Anda ingin saya buatkan mock mode untuk testing tanpa hardware ESP32.

## Files yang Diupdate

- ✅ [lib/config.ts](smart-door-web/lib/config.ts) - Auto-set default API key
- ✅ [.env.local](smart-door-web/.env.local) - Added NEXT_PUBLIC_DEFAULT_API_KEY
- ✅ [app/settings/page.tsx](smart-door-web/app/settings/page.tsx) - Added test connection button

## Testing

1. Restart Next.js dev server
2. Refresh browser
3. API key akan auto-set dari environment lokal
4. Dashboard akan connect ke ESP32 di `10.10.1.5`

Jika ESP32 tidak menyala, akan tetap error tapi bukan 401 lagi.
