# Smart Door Lock - Web Dashboard

Modern IoT web dashboard untuk kontrol dan monitoring smart door lock berbasis ESP32.

## 🚀 Features

### Dashboard
- **Real-time Door Status** - Monitor status pintu (locked/unlocked) secara real-time
- **Last Access Info** - Informasi akses terakhir dengan UID kartu RFID
- **Remote Door Control** - Buka/tutup pintu dari web browser
- **System Information** - WiFi signal, IP address, uptime ESP32

### Card Management
- **List Cards** - Lihat semua kartu RFID yang terdaftar
- **Add Cards** - Tambah kartu baru dengan UID (support format BE:02:28:DB atau BE0228DB)
- **Remove Cards** - Hapus kartu dari sistem
- **Card Nicknames** - Beri nama/label untuk setiap kartu (disimpan di browser)

### Access Logs
- **History Tracking** - Riwayat akses tersimpan di localStorage (max 100 entries)
- **Filter Logs** - Filter berdasarkan status (all/unlocked/denied)
- **Export Logs** - Download riwayat sebagai JSON atau CSV
- **Clear Logs** - Hapus semua riwayat

### Settings
- **ESP32 Configuration** - Konfigurasi IP address ESP32
- **Auto-Lock Timer** - Atur durasi auto-lock (belum connected ke ESP32)
- **Notifications** - Toggle notifikasi toast
- **Buzzer Test** - Test buzzer dari web
- **ESP32 Restart** - Remote restart ESP32 device

## 🛠️ Tech Stack

- **Next.js 15** - React framework dengan App Router
- **TypeScript** - Type safety
- **Tailwind CSS** - Styling dengan dark theme
- **React Hot Toast** - Toast notifications
- **Lucide React** - Modern icon library
- **WebSocket** - Real-time communication dengan ESP32

## 📦 Installation

```bash
# Install dependencies
npm install

# Development server
npm run dev

# Build for production
npm run build

# Start production server
npm start
```

Server akan berjalan di [http://localhost:3000](http://localhost:3000)

## 🔧 Configuration

### ESP32 IP Address

Default IP ESP32: `10.10.1.5`

Untuk mengubah:
1. Buka **Settings** page
2. Masukkan IP address baru
3. Klik **Save**

IP disimpan di localStorage browser.

### Kustomisasi

Edit file konfigurasi:
- `/lib/config.ts` - ESP32 IP, WebSocket port
- `/lib/types.ts` - TypeScript interfaces
- `/app/layout.tsx` - Global layout & styling

## 📡 API Documentation

Lihat [API.md](./API.md) untuk dokumentasi lengkap REST API dan WebSocket.

## 🎨 UI Components

Components terorganisir dan reusable:

```
components/
├── ui/              # Base UI components
│   ├── Button.tsx
│   ├── Card.tsx
│   └── Badge.tsx
├── layout/          # Layout components
│   ├── Sidebar.tsx
│   └── Header.tsx
└── dashboard/       # Page-specific components
```

## 📱 Pages

- `/` - Dashboard utama
- `/cards` - Card management
- `/logs` - Access history
- `/settings` - System settings

## 🌐 Deployment

### Vercel (Recommended)
```bash
npm install -g vercel
vercel
```

### Docker
```dockerfile
FROM node:20-alpine
WORKDIR /app
COPY package*.json ./
RUN npm ci --production
COPY . .
RUN npm run build
EXPOSE 3000
CMD ["npm", "start"]
```

### Manual Server
```bash
npm run build
npm start
```

## 🐛 Troubleshooting

### WebSocket Connection Failed
- Pastikan ESP32 IP address benar di Settings
- Check ESP32 sudah online
- Pastikan di jaringan yang sama dengan ESP32

### API Not Responding
- Verify ESP32 IP address
- Check ESP32 serial monitor untuk error
- Pastikan WiFi ESP32 connected

## 📝 Development

### Folder Structure
```
smart-door-web/
├── app/              # Next.js pages (App Router)
├── components/       # React components
├── lib/              # Utilities & helpers
├── hooks/            # Custom React hooks
└── public/           # Static assets
```

### Code Style
- **TypeScript** strict mode enabled
- **ESLint** untuk linting
- **Tailwind CSS** untuk styling

## 🔗 Related

- **ESP32 Firmware**: `../smart-door-iot/`
- **API Documentation**: [API.md](./API.md)

---

**Built with ❤️ using Next.js, TypeScript & Tailwind CSS**

