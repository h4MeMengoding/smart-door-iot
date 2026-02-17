# Smart Door Lock — Copilot Instructions

## Architecture Overview

This is a **two-component IoT system**: an ESP32 firmware (`smart-door-iot/`) and a Next.js 15 web dashboard (`smart-door-web/`). They communicate over three paths:

1. **Browser ↔ ESP32 WebSocket** (`wss://<esp32>/ws?apikey=<key>`) — real-time door status, card events, clone status
2. **Browser → ESP32 HTTP** (via `lib/api.ts` `ApiClient`) — door control, card CRUD, config changes
3. **ESP32 → Next.js API** (`POST /api/logs` with `x-api-key` header) — access log persistence to Postgres

The ESP32 is the **source of truth** for door state, cards (in NVS), and config. The web DB (Prisma/Postgres) mirrors card data and stores access logs. Card sync is bidirectional: ESP32 broadcasts `card_added`/`card_removed` via WebSocket → dashboard calls `POST /api/cards/sync-db` to reconcile.

## ESP32 Firmware (`smart-door-iot/`)

- **PlatformIO** project targeting `esp32dev` with Arduino framework
- **Non-blocking state machine** in `StateMachine.cpp` — states: `IDLE → AUTH_CHECK → PRE_UNLOCK → UNLOCK`, plus `REGISTRATION_MODE` and `CLONE_MODE`. All timing uses `millis()`, never `delay()`.
- **Module pattern**: each subsystem has a paired `.h`/`.cpp` (e.g., `CardManager`, `BuzzerController`, `DoorController`). Global state lives in `GlobalState.h/cpp`.
- **Config**: all pin definitions, timing constants, WiFi, and auth in `include/config.h`. Card UIDs stored in NVS with prefix `user_`. Per-card delays: `"d" + UID_HEX`, schedules: `"s" + UID_HEX`.
- **API auth**: all ESP32 HTTP endpoints validate `X-API-Key` header (see `validateApiKey()` in `APIHandler.cpp`). WebSocket accepts `?apikey=` query param.
- **Build/upload**: `pio run -t upload` (USB) or OTA via `env:esp32dev-ota` in `platformio.ini`
- **Key libs**: MFRC522, ESPAsyncWebServer, AsyncTCP, ArduinoJson v6

## Web Dashboard (`smart-door-web/`)

- **Next.js 15** with App Router, React 19, React Compiler enabled, TypeScript
- **Database**: Prisma ORM with PostgreSQL via `@prisma/adapter-pg`. Prisma client outputs to `lib/generated/prisma/`. Run `npm run db:migrate` or `npm run db:push` for schema changes.
- **Auth (dashboard)**: 6-digit PIN → HMAC-signed session cookie (`smart-door-session`, 30-day expiry). Rate-limited (5 attempts, 5-min lockout). Middleware in `middleware.ts` protects all routes except `/login`, `/api/auth/*`, `/api/logs`, `/api/health`.
- **Auth (ESP32→API)**: `x-api-key` header. Routes that serve both ESP32 and dashboard check either auth method.
- **All API routes** use `export const dynamic = 'force-dynamic'` — no response caching.

### Key Patterns

- **Styling**: CSS custom properties for colors (`var(--primary)`, `var(--bg-surface)`, etc.) + Tailwind for layout/spacing only. **Never use Tailwind color classes** — use CSS vars for theme support. Utility: `cn()` from `lib/utils.ts` (clsx + tailwind-merge).
- **Icons**: exclusively `lucide-react`
- **Animations**: `framer-motion` (AnimatePresence, motion components)
- **Event bus** (`lib/dashboardEvents.ts`): client-side cross-component sync. Events: `cards-changed`, `card-renamed`, `cards-instant-update`, `cards-syncing`, `cards-synced`, `state-changed`. Components subscribe in `useEffect` and clean up on unmount.
- **Server events** (`lib/events.ts`): in-memory `logEvents` emitter for pushing new logs server-side.
- **Components fetch their own data** and subscribe to `dashboardEvents` for updates — not pure top-down prop drilling.
- **UI primitives**: `components/ui/Card.tsx` (`Card`, `CardHeader`, `CardTitle`, `CardContent`), `Badge.tsx`, `Button.tsx`, `RfidCardVisual.tsx`
- **Drag-and-drop dashboard**: `@dnd-kit` in `app/page.tsx` for card arrangement

### Real-time Data Flow

- `hooks/useWebSocket.ts` — connects directly to ESP32, auto-reconnect with exponential backoff
- `hooks/usePolling.ts` — polls ESP32 `/api/status` every 2s as fallback
- `hooks/useServerLogs.ts` — incremental polling `GET /api/logs?since=<ISO>` every 3s for access history
- SSE (`/api/logs/stream`) is deprecated (Vercel 10s timeout) — use polling instead

### Database Schema (Prisma)

Key models: `AccessCredential` (RFID cards, `uid` unique), `AccessLog` (append-only access history), `CardDelayConfig`, `CardDelaySchedule`, `SystemConfig` (key-value), `SystemEvent`. Master cards are filtered out in API responses via `isMasterCardUid()` in `lib/utils.ts`.

## Commands

| Task | Command | Dir |
|------|---------|-----|
| Web dev server | `npm run dev` | `smart-door-web/` |
| Web build | `npm run build` | `smart-door-web/` |
| Prisma migrate | `npm run db:migrate` | `smart-door-web/` |
| Prisma studio | `npm run db:studio` | `smart-door-web/` |
| Prisma generate | `npx prisma generate` | `smart-door-web/` |
| Lint | `npm run lint` | `smart-door-web/` |
| ESP32 build+upload | `pio run -t upload` | `smart-door-iot/` |
| ESP32 OTA upload | `pio run -e esp32dev-ota -t upload` | `smart-door-iot/` |
| Serial monitor | `pio device monitor` | `smart-door-iot/` |

## Important Files

- `smart-door-iot/include/config.h` — all ESP32 pin/timing/WiFi/auth constants
- `smart-door-iot/src/StateMachine.cpp` — core state machine logic
- `smart-door-iot/src/APIHandler.cpp` — all REST + WebSocket endpoints
- `smart-door-web/lib/config.ts` — ESP32 URL + API key config
- `smart-door-web/lib/types.ts` — shared TypeScript interfaces (DoorStatus, Card, WebSocketMessage, etc.)
- `smart-door-web/lib/db.ts` — Prisma data access layer
- `smart-door-web/middleware.ts` — auth middleware with public path whitelist
- `smart-door-web/prisma/schema.prisma` — database schema
