# Repository Guidelines

## Project Structure & Module Organization

This repository contains two deployable applications. `smart-door-web/` is the Next.js dashboard: routes and API handlers are in `app/`, reusable UI is in `components/`, client hooks in `hooks/`, and server/shared code in `lib/`. Database schema and migrations live in `smart-door-web/prisma/`; static assets are under `smart-door-web/public/`. `smart-door-iot/` is the ESP32 firmware, with headers in `include/`, Arduino/PlatformIO source in `src/`, and future firmware tests in `test/`. Root-level Markdown files document setup, MQTT, security, and integration.

## Build, Test, and Development Commands

Run web commands from `smart-door-web/`:

```bash
npm install          # install dependencies and generate Prisma client
npm run dev          # start Next.js at http://localhost:3000
npm run lint         # run ESLint and Next.js TypeScript rules
npm run build        # create a production build
npm run db:migrate   # create/apply a Prisma development migration
```

Run firmware commands from `smart-door-iot/`:

```bash
pio run              # compile the default ESP32 environment
pio test             # run PlatformIO tests when test cases exist
```

Do not upload firmware or run database-changing commands against shared environments without confirming the target configuration first.

## Coding Style & Naming Conventions

Use TypeScript with strict typing in the web app. Follow the existing two-space indentation, double quotes, semicolons, and `@/` imports. Name React components in `PascalCase` (`DoorStatusCard.tsx`), hooks as `useThing`, and utilities in `camelCase`. Keep route handlers at `app/api/<resource>/route.ts`. Use Tailwind utility classes and shared components before adding page-specific styling.

For firmware, keep declarations in matching `include/Foo.h` and implementations in `src/Foo.cpp`; use existing `PascalCase` class/file names. Never commit Wi-Fi credentials, API keys, push keys, or OTA secrets.

## Testing Guidelines

There is no web test runner configured yet. At minimum, run `npm run lint` and `npm run build` for dashboard changes, and manually exercise affected API/UI flows. Add PlatformIO tests under `smart-door-iot/test/` for firmware logic and run `pio test`. Test names should describe behavior, e.g. `locks_after_timeout`.

## Commit & Pull Request Guidelines

Recent history follows concise Conventional Commit-style subjects such as `feat: add Docker support` and `refactor: improve SettingsModal layout`. Use an imperative, scoped summary; keep unrelated changes separate. PRs should state the user-visible impact, note configuration or migration changes, link relevant issues, and include screenshots for dashboard UI changes. Call out hardware, database, and security-impacting changes explicitly.
