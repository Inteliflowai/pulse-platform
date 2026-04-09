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
pnpm test                                 # Run vitest tests
pnpm --filter @pulse/cloud-admin dev      # Run single app
pnpm --filter @pulse/cloud-admin build    # Build single app
rm -rf apps/cloud-admin/.next             # Fix stale 404s or route caching issues
npx tsx scripts/seed-admin.ts             # Seed admin user
```

## Dev Ports

| Service | Port |
|---------|------|
| cloud-admin (Next.js) | 3000 |
| node-agent (Express) | 3100 |
| jellyfin-adapter (Express) | 3101 |
| sync-worker health | 3200 |

## Architecture

Two environments — **cloud** (Supabase + Vercel) and **on-prem** (node services + SQLite + Jellyfin):

- `apps/cloud-admin` — Next.js 14 app router deployed to Vercel. 40 pages + 33 API routes. Dashboard UI, content management, curriculum builder, quiz engine, analytics, monitoring. Uses Supabase for auth, DB (RLS), and file storage (`pulse-assets` bucket).
- `apps/node-agent` — Express on the school appliance (:3100). Device enrollment, self-contained offline classroom player (HTML with student login, sequenced learning, quiz engine, conductor sync), stream routing, heartbeats, auto-backup, update manager.
- `apps/jellyfin-adapter` — Express wrapping Jellyfin REST API (:3101). Asset registration searches Jellyfin items by path (not SearchTerm). Only interface to Jellyfin.
- `apps/sync-worker` — Background worker. Polls cloud for sync jobs, downloads via signed URLs, verifies SHA-256 checksums, copies to Jellyfin media directory (supports cross-device via copy+delete). Bandwidth throttling via `SYNC_BANDWIDTH_LIMIT_MBPS`.
- `packages/shared` — TypeScript types, enums, constants, curriculum types. Must build before apps.

## Pages (40 total)

Key dashboard pages: Global Overview, School Dashboard, Classrooms, Curriculum (sequences + quiz builder), Results (quiz analytics with charts), Progress (student tracking), Content (assets + packages + sync jobs), Devices, Users, Audit Log, Analytics (historical trends), Monitoring (fleet + school), Search (global), Settings, Releases. Plus: Login, Reset Password, API Docs (`/api-docs`).

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
- Sequences are cached to local SQLite on every cloud fetch; served from cache when offline.
- Quiz attempts stored locally in `local_quiz_attempts`, synced to cloud when WAN returns.
- Classroom player works fully offline after initial load.

### Classroom Player (node-agent)
Self-contained HTML page served at `/classroom?token=`. No external CDN dependencies. Features:
- Student login screen (student number entry)
- Sequenced learning (video → quiz → video with timeline navigation)
- Inline quiz engine with timer, auto-submit, score display
- Conductor sync: polls `/conductor/state` every 5s; teacher advances → students follow
- Mobile responsive (breakpoints at 640px and 380px)
- i18n support: English, French, Portuguese, Swahili, Zulu, Afrikaans (`src/i18n.ts`)

### Cross-Device File Moves
`renameSync` fails with `EXDEV` across drives. The `moveFile` helper in `sync-worker/src/downloader.ts` falls back to `copyFileSync` + `unlinkSync`.

### Multi-Tenant Isolation
Every Supabase query must include a `tenant_id` filter. RLS policies enforce this, but be explicit.

### Asset Deduplication
`src/lib/asset-dedup.ts` checks SHA-256 checksum against existing assets before upload.

### Real-Time Updates
`src/lib/realtime.ts` provides `useRealtimeTable()` and `useRealtimeRow()` hooks wrapping Supabase Realtime subscriptions.

### Notifications
`notifications` table + API at `/api/notifications` (GET, POST, PATCH). Supports per-user and broadcast notifications.

### Content Scheduling
Packages and sequences have `publish_at` and `expire_at` columns for future publish/auto-expire.

## Environment Setup

Each app has its own `.env` file (gitignored). Cloud-admin also needs `.env.local` for `NEXT_PUBLIC_*` vars.

- **Cloud**: `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`
- **Node services**: `NODE_ID`, `NODE_REGISTRATION_TOKEN`, `CLOUD_API_URL`, `JELLYFIN_BASE_URL`, `JELLYFIN_API_KEY`
- **Sync worker**: `MEDIA_DIR` (can be a network share like `V:/pulse`), `SYNC_BANDWIDTH_LIMIT_MBPS` (0 = unlimited)

## Database

- **Cloud**: Supabase Postgres with RLS. 6 migrations in `supabase/migrations/` (001-006). Run via SQL Editor.
- **Local node**: SQLite via better-sqlite3. Schema auto-created on startup via `initDb()`.

## Testing

```bash
pnpm test                                 # Run all tests (vitest)
```

Tests in `packages/shared/__tests__/` and `apps/cloud-admin/__tests__/`. 15 tests covering shared types, enums, API structure, and payload validation.

## CI/CD

GitHub Actions workflow in `.github/workflows/ci.yml`. Runs on push/PR to main: install → build shared → build cloud-admin → run tests.

## Deployment

- **Cloud admin** → Vercel. Root directory: `apps/cloud-admin`. Build command: `cd ../.. && pnpm install && pnpm --filter @pulse/shared build && pnpm --filter @pulse/cloud-admin build`
- **Node services** → Docker on school appliance (`docker/install.sh`), or directly via `pnpm dev`.
- **API docs** available at `/api-docs` (no auth required).

## Integrations

Implemented in `apps/node-agent/src/integrations/`:
- `core-integration.ts` — Import quizzes from CORE, sync results back
- `spark-integration.ts` — Import interactive assets, report completions
- `lms-sync.ts` — Batch sync quiz results + progress to cloud (5-min interval)

## Node Agent Features

- Auto-backup SQLite every 6 hours (`src/backup.ts`), max 10 retained. Endpoints: `POST /backup`, `GET /backups`, `POST /restore`
- Update manager polls cloud every 10 min for new software versions (`src/update-manager.ts`)
- Heartbeat with system metrics: CPU, memory, disk, sessions, enrolled devices (`src/heartbeat.ts`)
- Bandwidth throttling for sync downloads (`sync-worker/src/throttle.ts`)
