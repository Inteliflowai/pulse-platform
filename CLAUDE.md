# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What is Pulse

Pulse is Inteliflow's school edge-node + cloud control plane. It delivers media, documents, and assignments to schools via on-prem appliances that survive internet outages, syncing to cloud when connectivity returns. The media engine is Jellyfin (wrapped, not replaced). Pulse includes a curriculum system with sequenced learning (video → quiz → video), a teacher conductor for live classroom control, and integrations with CORE (assessments), SPARK (interactives), and LMS (grade sync).

## Build & Dev Commands

```bash
pnpm install                              # Install dependencies
pnpm --filter @pulse/shared build         # Build shared (required before other builds)
pnpm build                                # Build everything
pnpm dev                                  # Run all services in dev mode
pnpm test                                 # Run vitest tests (15 tests)
pnpm --filter @pulse/cloud-admin dev      # Run single app
pnpm --filter @pulse/cloud-admin build    # Build single app
rm -rf apps/cloud-admin/.next             # Fix stale 404s or route caching issues
npx tsx scripts/seed-admin.ts             # Seed admin user

# Marketing landing page
cd marketing && npm install && npm run build  # Build for ReactPress deployment
```

## Dev Ports

| Service | Port |
|---------|------|
| cloud-admin (Next.js) | 3000 |
| node-agent (Express) | 3100 |
| jellyfin-adapter (Express) | 3101 |
| sync-worker health | 3200 |

## Repo Structure

```
pulse/
  apps/
    cloud-admin/        # Next.js 14 — Vercel. 40+ pages, 34 API routes
    node-agent/         # Express — school appliance (:3100)
    jellyfin-adapter/   # Express — Jellyfin wrapper (:3101)
    sync-worker/        # Background sync engine
  packages/shared/      # TypeScript types, enums, constants
  marketing/            # React landing page for inteliflowai.com/pulse (ReactPress)
  docker/               # Docker Compose + install script
  supabase/
    migrations/         # 6 SQL migrations (001-006)
    email-templates/    # Branded invite, reset, confirm templates
  scripts/              # Dev utilities (seed, auth test, node setup)
```

## Architecture

Two environments — **cloud** (Supabase + Vercel) and **on-prem** (node services + SQLite + Jellyfin):

- `apps/cloud-admin` — Next.js 14 app router on Vercel. Dashboard UI, content management, curriculum builder, quiz engine, analytics, monitoring, in-app help system. Uses Supabase for auth, DB (RLS), and file storage (`pulse-assets` bucket).
- `apps/node-agent` — Express on the school appliance (:3100). Device enrollment, self-contained offline classroom player, stream routing, heartbeats, auto-backup, update manager. Environment validated on startup — fails fast on missing `NODE_ID` or `CLOUD_API_URL`.
- `apps/jellyfin-adapter` — Express wrapping Jellyfin REST API (:3101). Asset registration searches all Jellyfin items by path. Only interface to Jellyfin.
- `apps/sync-worker` — Background worker. Polls cloud for sync jobs, downloads via signed URLs, verifies SHA-256 checksums, copies to Jellyfin media directory (cross-device via copy+delete). Bandwidth throttling via `SYNC_BANDWIDTH_LIMIT_MBPS`. Environment validated on startup.
- `packages/shared` — TypeScript types, enums, constants, curriculum types. Must build before apps.
- `marketing/` — Standalone React app (CRA) for the marketing landing page. Deployed via WordPress ReactPress plugin at `inteliflowai.com/pulse`. Uses Inteliflow brand palette (purple gradient, Glass cards, Glow orbs). Not part of the pnpm workspace — has its own `package.json`.

## Key Pages

Dashboard: Global Overview, School Dashboard, Classrooms, Curriculum (sequences + quiz builder), Results (quiz analytics with charts), Progress (student tracking), Content (assets + packages + sync jobs), Devices, Users, Analytics (historical trends), Audit Log, Monitoring (fleet + school), Search (global), Settings, Releases. Public: Login, Reset Password, Terms of Service, Privacy Policy, API Docs (`/api-docs`).

## Key Patterns

### Supabase Clients (cloud-admin)
Three clients in `apps/cloud-admin/src/lib/supabase/`:
- `browser.ts` — `createBrowserClient` for client components (anon key)
- `server.ts` — `createServerClient` for server components (async, uses cookies)
- `admin.ts` — `createAdminSupabaseClient` using service role key. **NOT async**. Bypasses RLS.

### Role-Based Access
Layout guards in `src/app/(dashboard)/dashboard/{global,school,content}/layout.tsx` use `requireRole()` from `src/lib/auth-guard.ts`. Global pages require `super_admin`. School pages allow admin + teacher roles. Content pages allow content_manager+.

### Next.js Route Handlers
Dynamic params are Promises: `const { id } = await params;`. All routes return `{ error: string }` on failure. Rate limited at 120 req/min per IP via middleware.

### SQLite on Node Services
Both node-agent and sync-worker use `better-sqlite3` with WAL mode. DB files in `apps/{service}/data/`. Functions are **synchronous** — use try/catch, not `.catch()`. Tables: enrolled_devices, classroom_cache, local_packages, local_assets, student_sessions, conductor_state, local_quiz_attempts, cached_sequences.

### Offline-First Design
- Node services gracefully handle cloud unreachability. Use `AbortSignal.timeout()` on fetch calls.
- Sequences cached to local SQLite on every cloud fetch; served from cache when offline.
- Quiz attempts stored locally in `local_quiz_attempts`, synced to cloud when WAN returns.
- Student sessions auto-expire after 24 hours; cleanup runs hourly.
- Classroom player works fully offline after initial load.

### Classroom Player (node-agent)
Self-contained HTML page served at `/classroom?token=`. No external CDN dependencies. Features:
- Student login screen (student number entry, 24h session expiry)
- Sequenced learning (video → quiz → video with timeline navigation)
- Inline quiz engine with timer, auto-submit, score display
- Conductor sync: polls `/conductor/state` every 5s; teacher advances → students follow
- Mobile responsive (breakpoints at 640px and 380px)
- i18n: English, Portuguese, Spanish (`src/i18n.ts`)

### In-App Help System
Components in `src/components/help/`:
- `tour-engine.tsx` — Interactive tour with element highlighting, overlay mask, step navigation
- `onboarding-wizard.tsx` — 6-step getting started guide, auto-shows on first login
- `help-panel.tsx` — Slide-out docs panel with 20+ articles, search, tour launcher
- `tooltip.tsx` — `<HelpTooltip text="..." />` for inline contextual help
- `tours.ts` — 5 pre-built tours (Dashboard, Content, Curriculum, Classroom, Monitoring)
- Wired via `HelpWrapper` in the dashboard layout

### Security
- CORS + CSP + X-Frame-Options + X-Content-Type-Options headers on node-agent
- Rate limiting: 120 req/min per IP on all cloud API routes (middleware), 10 req/min on enrollment
- Environment validation: services fail fast with clear error on missing required vars
- Request validation utility: `src/lib/validate.ts`
- Error tracking: `src/lib/error-tracking.ts` with structured JSON logging

### Cross-Device File Moves
`renameSync` fails with `EXDEV` across drives. The `moveFile` helper in `sync-worker/src/downloader.ts` falls back to `copyFileSync` + `unlinkSync`.

### Multi-Tenant Isolation
Every Supabase query must include a `tenant_id` filter. RLS policies enforce this, but be explicit.

### Real-Time Updates
`src/lib/realtime.ts` provides `useRealtimeTable()` and `useRealtimeRow()` hooks. Realtime enabled on: nodes, sync_jobs, node_events, node_metrics, devices, notifications.

### Marketing Landing Page
`marketing/` is a standalone CRA React app using Inteliflow brand system (BRAND palette, Glass/Glow components, inline styles). Deployed to WordPress via ReactPress. CSS overrides WordPress theme padding via `usePageStyles()`. Build with `cd marketing && npm run build`, upload `build/` folder to ReactPress.

## Environment Setup

Each app has its own `.env` file (gitignored). Cloud-admin also needs `.env.local` for `NEXT_PUBLIC_*` vars.

- **Cloud**: `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`
- **Node services**: `NODE_ID`, `NODE_REGISTRATION_TOKEN`, `CLOUD_API_URL`, `JELLYFIN_BASE_URL`, `JELLYFIN_API_KEY`
- **Sync worker**: `MEDIA_DIR` (can be a network share like `V:/pulse`), `SYNC_BANDWIDTH_LIMIT_MBPS` (0 = unlimited)

## Database

- **Cloud**: Supabase Postgres with RLS. 6 migrations in `supabase/migrations/` (001-006). Run via SQL Editor.
- **Local node**: SQLite via better-sqlite3. Schema auto-created on startup via `initDb()`.
- **Cleanup**: `GET /api/cron/cleanup-metrics` deletes node_metrics, heartbeat events, and read notifications older than 30 days.

## Testing

```bash
pnpm test    # vitest — 15 tests
```

Tests in `packages/shared/__tests__/` and `apps/cloud-admin/__tests__/`.

## CI/CD

GitHub Actions in `.github/workflows/ci.yml`. On push/PR to main: install → build shared → build cloud-admin → run tests.

## Deployment

- **Cloud admin** → Vercel at `pulse.inteliflowai.com`. Root directory: `apps/cloud-admin`. Build command: `cd ../.. && pnpm install && pnpm --filter @pulse/shared build && pnpm --filter @pulse/cloud-admin build`
- **Marketing page** → WordPress ReactPress at `inteliflowai.com/pulse`. Build `marketing/`, upload `build/` folder.
- **Node services** → Docker on school appliance (`docker/install.sh`), or directly via `pnpm dev`.
- **API docs** at `/api-docs` (no auth).
- **Health check** at `/api/health` (returns Supabase connectivity status).

## Integrations

In `apps/node-agent/src/integrations/`:
- `core-integration.ts` — Import quizzes from CORE, sync results back
- `spark-integration.ts` — Import interactive assets, report completions
- `lms-sync.ts` — Batch sync quiz results + progress to cloud (5-min interval)

## Node Agent Features

- Auto-backup SQLite every 6h (`src/backup.ts`), max 10 retained. Endpoints: `POST /backup`, `GET /backups`, `POST /restore`
- Update manager polls cloud every 10 min (`src/update-manager.ts`)
- Heartbeat with system metrics: CPU, memory, disk, sessions, devices (`src/heartbeat.ts`)
- Student session expiry (24h) with hourly cleanup
- Bandwidth throttling for sync downloads (`sync-worker/src/throttle.ts`)
- Static file serving from `public/` (Pulse logo for classroom player)

## Legal

- Terms of Service at `/terms`
- Privacy Policy at `/privacy` (covers COPPA, FERPA, GDPR)
- Branded email templates in `supabase/email-templates/` (invite, reset password, confirm email)
