# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What is Pulse

Pulse is Inteliflow's school edge-node + cloud control plane. It delivers media, documents, and assignments to schools via on-prem appliances that survive internet outages, syncing to cloud when connectivity returns. The media engine is Jellyfin (wrapped, not replaced). Pulse includes a curriculum system with sequenced learning (video → quiz → video), a teacher conductor for live classroom control, classroom scheduling with STB auto-load, CORE handoff for quizzes (Pulse fires lesson-complete, CORE owns the quiz), and integrations with CORE (assessments), SPARK (interactives), and LMS (grade sync).

## Build & Dev Commands

```bash
pnpm install                              # Install dependencies
pnpm --filter @pulse/shared build         # Build shared (required before other builds)
pnpm build                                # Build everything
pnpm dev                                  # Run all services in dev mode
pnpm test                                 # Run all tests via turbo (209 tests)
pnpm test:ci                              # Verbose test output for CI
pnpm test:coverage                        # Run with coverage report
pnpm typecheck                            # TypeScript check all packages
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
    cloud-admin/        # Next.js 14 — Vercel. 50+ pages, 45+ API routes
    node-agent/         # Express — school appliance (:3100)
    jellyfin-adapter/   # Express — Jellyfin wrapper (:3101)
    sync-worker/        # Background sync engine
  packages/shared/      # TypeScript types, enums, constants
  marketing/            # React landing page for inteliflowai.com/pulse (ReactPress)
  docker/               # Docker Compose + install script
  supabase/
    migrations/         # 13 SQL migrations (001-013)
    email-templates/    # Branded invite, reset, confirm templates
  scripts/              # Dev utilities (seed, auth test, node setup)
```

## Architecture

Two environments — **cloud** (Supabase + Vercel) and **on-prem** (node services + SQLite + Jellyfin):

- `apps/cloud-admin` — Next.js 14 app router on Vercel. Dashboard UI, content management, curriculum builder, quiz engine, schedule management, analytics, monitoring (cards + fleet comparison table), proactive alerting, in-app help system. Uses Supabase for auth, DB (RLS), and file storage (`pulse-assets` bucket).
- `apps/node-agent` — Express on the school appliance (:3100). Device enrollment (schedule-aware), self-contained offline classroom player (with accessibility controls), stream routing, Jellyfin webhook handler, lesson-complete events, schedule resolver, heartbeats, auto-backup with verification, update manager with maintenance windows, remote diagnostics, mobile+desktop teacher conductor. Environment validated on startup — fails fast on missing `NODE_ID` or `CLOUD_API_URL`.
- `apps/jellyfin-adapter` — Express wrapping Jellyfin REST API (:3101). Asset registration searches all Jellyfin items by path. Only interface to Jellyfin.
- `apps/sync-worker` — Background worker. Polls cloud for sync jobs, downloads via signed URLs, verifies SHA-256 checksums, copies to Jellyfin media directory (cross-device via copy+delete). Bandwidth throttling via `SYNC_BANDWIDTH_LIMIT_MBPS`. Environment validated on startup.
- `packages/shared` — TypeScript types, enums, constants, curriculum types, schedule types. Must build before apps.
- `marketing/` — Standalone React app (CRA) for the marketing landing page. Deployed via WordPress ReactPress plugin at `inteliflowai.com/pulse`. Uses Pulse brand palette (warm dark brown base `#120800`, burnt orange `#f26522` / deep orange `#e84c1e` accents from the Pulse logo). Glass cards, Glow orbs, inline styles. Not part of the pnpm workspace — has its own `package.json`.

## Key Pages

Dashboard: Global Overview, School Dashboard, Classrooms, Curriculum (sequences + quiz builder), Results (quiz analytics with charts), Progress (student tracking), Content (assets + packages + sync jobs), Devices, Users, Analytics (historical trends), Audit Log, Monitoring (fleet cards + comparison table), Search (global), Settings, Releases, Schedule (weekly calendar), Quick Lesson (3-step wizard). Public: Login (sliding backgrounds), Reset Password, Terms of Service, Privacy Policy, API Docs (`/api-docs`), Product Landing Page (`/pulse` — animated demo, classroom simulator, testimonials, FAQ).

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
Both node-agent and sync-worker use `better-sqlite3` with WAL mode. DB files in `apps/{service}/data/`. Functions are **synchronous** — use try/catch, not `.catch()`. Tables: enrolled_devices (with schedule_id, class_group_id), classroom_cache (with delivery_mode), local_packages, local_assets, student_sessions, conductor_state, local_quiz_attempts, cached_sequences, lesson_completions, classroom_schedule_cache, class_group_students_cache.

### Offline-First Design
- Node services gracefully handle cloud unreachability. Use `AbortSignal.timeout()` on fetch calls.
- Sequences cached to local SQLite on every cloud fetch; served from cache when offline.
- Quiz attempts stored locally in `local_quiz_attempts`, synced to cloud when WAN returns.
- Lesson completions stored locally, synced to CORE via background worker every 5 minutes.
- Student sessions auto-expire after 24 hours; cleanup runs hourly.
- Classroom player works fully offline after initial load.
- Schedule cache survives node-agent restarts (SQLite persistent).

### Lesson-Complete Event Flow (Prompt 10)
When a video ends (≥85% watched), Pulse fires a lesson-complete event:
1. Always inserts into local SQLite `lesson_completions` table.
2. If WAN connected + student identified: POSTs to CORE (`/api/pulse/lesson-complete`).
3. If WAN down: triggers offline fallback quiz (3 MCQ only, no OEQ without CORE).
4. Background sync worker retries unsynced completions every 5 min (max 10 attempts).
5. Classroom player shows CORE redirect (5s countdown, cancellable) or offline fallback.
- `src/lesson-complete.ts` — `fireLessonComplete()` never throws.
- `src/lesson-complete-sync.ts` — Background retry worker.
- `src/jellyfin-webhook.ts` — Jellyfin PlaybackStop → `fireLessonComplete()`.
- `src/core-quiz-url.ts` — Builds CORE redirect URL.

### Classroom Scheduling (Prompt 11)
Schedule-based routing: which STB plays what content for which students at what time.
- Cloud: `classroom_schedules` table (Supabase migration 009). Supports once/daily/weekly/weekdays/custom recurrence.
- Node: `classroom_schedule_cache` table (SQLite). Synced from cloud via config endpoint on every heartbeat cycle.
- `src/schedule-resolver.ts` — `getActiveSchedule()`, `getUpcomingSchedule()`, `getAllSchedulesForClassroom()`. Handles all recurrence patterns with ISO weekday matching.
- `GET /classroom/current-schedule?token=` — Returns active, upcoming, and day schedule. Polled by STB and classroom player.
- Enrollment is schedule-aware: devices are associated with the active class group.
- Cloud admin: `/dashboard/school/schedule` — Weekly calendar view per classroom, "Schedule a Class" modal, teacher self-service.
- Schedule changes propagate to nodes within one heartbeat cycle (60 seconds).

### Classroom Player (node-agent)
Self-contained HTML page served at `/classroom?token=`. No external CDN dependencies. Features:
- Student login screen (student number entry, 24h session expiry)
- Sequenced learning (video → quiz → video with timeline navigation)
- Sequence progress indicator (step dots with current/done states)
- Video time display (elapsed / total)
- Inline quiz engine with fixed-position timer (color changes: white → amber → red with pulse)
- MCQ buttons with letter prefixes (A/B/C/D), 56px min-height, touch-optimized
- CORE redirect on lesson complete (5-second cancellable countdown)
- Offline fallback quiz (3 MCQ only when WAN down)
- Conductor sync: polls `/conductor/state` every 5s; teacher advances → students follow
- Schedule context in header (class group name, sequence, teacher)
- Waiting state with live clock, day schedule timeline, ambient animation
- Student class group validation (advisory, not blocking)
- Accessibility panel: font size (S/M/L/XL), high contrast mode, localStorage persistence
- Offline mode banner (dismissible, EN/PT/ES)
- Mobile responsive (breakpoints at 640px and 380px)
- i18n: English, Portuguese, Spanish (embedded inline)

### Teacher Conductor (node-agent)
Served at `/conductor?token=`. Dual layout — detects screen width at load:
- **Desktop** (≥768px): existing list-based conductor with sequence browser, item navigation, now-showing card.
- **Mobile** (<768px): full-viewport layout with large center card (item icon + title), big action buttons (64px height), sequence progress dots, live session stats, touch gesture support (swipe left/right to navigate, long press to end).
- Schedule info shown in header (class group name, time remaining).

### Proactive Alerting (Prompt 12)
- `alert_subscriptions` table (migration 010): per-user, per-tenant, configurable alert types and channels (email, webhook).
- `src/lib/alerts/dispatcher.ts` — `dispatchAlert()` looks up subscribers, creates in-app notifications, delivers webhooks (5s timeout). Never blocks caller.
- Wired into heartbeat handler: fires on `jellyfin_unreachable`, `storage_high`, `storage_critical`.
- Alert types: node_offline, node_restored, storage_high, storage_critical, sync_failed, sync_recovered, jellyfin_unreachable, update_available, low_disk, backup_failed.
- API: `GET/POST /api/alerts/subscriptions`, `DELETE /api/alerts/subscriptions/[id]`.

### Remote Diagnostics (Prompt 12)
- Node-agent: `POST /diagnostics/collect` (X-Node-Token auth) — collects system metrics, service health, SQLite size, env check. Logs sanitized (strips lines with token/secret/key/password).
- Cloud-admin: `POST /api/nodes/[nodeId]/run-diagnostics` — proxies to node, re-sanitizes server-side.
- `src/diagnostics.ts` — `collectDiagnostics()`.

### Backup Verification (Prompt 12)
- Backups auto-verified on creation via `PRAGMA integrity_check`.
- `GET /backup/status` — returns last backup time, count, latest backup with verification status.
- `POST /backup/verify-latest` — runs integrity check on most recent backup.
- Cloud-admin: `POST /api/nodes/[nodeId]/verify-backup` — proxies to node.

### Maintenance Windows (Prompt 12)
- Stored in `nodes.metadata.maintenance_window`: `{ enabled, start_hour, end_hour, days }`.
- Pushed to node via config endpoint. Node caches in memory.
- Update manager checks `isInMaintenanceWindow()` before applying updates. If outside window, defers update.
- Supports overnight windows (e.g. 23:00–04:00).

### Quick Lesson Flow (Prompt 12)
3-step wizard at `/dashboard/school/quick-lesson`:
1. Select/upload video asset
2. Configure: title, subject, grade, class group, classroom, date/time, duration
3. Confirm & schedule
- `POST /api/quick-lesson` — Creates package, sequence, sync job, and schedule in one call.

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
- Diagnostics log sanitization: server-side stripping of sensitive patterns

### Cross-Device File Moves
`renameSync` fails with `EXDEV` across drives. The `moveFile` helper in `sync-worker/src/downloader.ts` falls back to `copyFileSync` + `unlinkSync`.

### Multi-Tenant Isolation
Every Supabase query must include a `tenant_id` filter. RLS policies enforce this, but be explicit. All new API routes and schedule queries are tenant-scoped.

### Real-Time Updates
`src/lib/realtime.ts` provides `useRealtimeTable()` and `useRealtimeRow()` hooks. Realtime enabled on: nodes, sync_jobs, node_events, node_metrics, devices, notifications.

### Brand Theme
The entire platform uses the Pulse logo's warm color palette:
- **Tailwind tokens** (`tailwind.config.ts`): `brand-primary` = `#f26522` (Pulse orange), `brand-primary-light` = `#f5803e` (lighter orange for text — higher contrast on dark backgrounds), `brand-bg` = `#110a04` (warm dark brown), `brand-surface` = `#1e1410` (warm surface).
- All text that was previously `text-brand-primary` uses `text-brand-primary-light` for readability (contrast ratio ~8.5:1).
- Semantic colors unchanged: `emerald` for success, `yellow` for warnings, `red` for errors — sufficient separation from the orange accent.
- Help system, sidebar active states, badges, buttons, focus rings all derive from these tokens.

### Login Page
Sliding CSS art background login page (matches Spark/CORE pattern):
- 5 CSS-only backgrounds rotating every 7 seconds with slide animation (signal waves, network constellation, warm pulse, sunrise, aurora).
- Frosted glass card: `blur(40px)`, 50% opacity warm dark brown, 24px border radius.
- Interactive navigation dots (bottom-right). Captions fade between slides.
- Forgot password mode. Eye toggle for password visibility.
- Terms/Privacy links in footer. Role-based redirect after login.

### Product Landing Page
Hosted on Vercel at `pulse.inteliflowai.com/pulse` — a `'use client'` Next.js page (`src/app/pulse/page.tsx`) with full metadata (`layout.tsx`).

Sections: Header (back to inteliflowai.com), Hero (animated demo + CTAs), Stats Bar, Features (8 cards), How It Works (3 steps), Architecture (cloud + node cards), Interactive Classroom Demo (simulator), Testimonials (3 quotes), Platform Ecosystem (LIFT/CORE/SPARK/PULSE), FAQ (6 items, accordion), Contact Form (mailto), Footer (CORE-style with Inteliflow logo attribution).

Components: `PulseAnimatedDemo` (4-screen 7s crossfade cycle: Dashboard, Player, Sequence Builder, Conductor), `PulseClassroomSimulator` (4-step interactive: video playback, CORE MCQ quiz with scoring, Spark prediction, per-question results breakdown).

Brand: dark warm brown base (`#120800`), burnt orange `#f26522` / deep orange `#e84c1e` accents, Glass/Glow components, DM Sans font, inline styles. Mobile responsive (720px + 380px breakpoints, nav links hidden, stats grid collapses, hero text scales).

Legacy: `marketing/` (CRA standalone) still exists for ReactPress deployment at `inteliflowai.com/pulse` but the canonical version is now the Vercel-hosted Next.js page.

## Environment Setup

Each app has its own `.env` file (gitignored). Cloud-admin also needs `.env.local` for `NEXT_PUBLIC_*` vars.

- **Cloud**: `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, `CRON_SECRET`
- **Cloud ↔ CORE (admin plane, platform-wide)**: `CORE_API_URL` (defaults to `https://app.inteliflowai.com`), `CORE_PROVISIONING_SECRET` — used by Pulse cloud to provision/revoke per-school Bearer keys on CORE via `POST /api/admin/platform-keys`. Never goes on nodes.
- **Node services**: `NODE_ID`, `NODE_REGISTRATION_TOKEN`, `CLOUD_API_URL`, `JELLYFIN_BASE_URL`, `JELLYFIN_API_KEY`
- **Node ↔ CORE (runtime, per-tenant)**: The Bearer key used on lesson-complete calls is no longer an env var. The cloud pushes the per-tenant `api_key` via `/api/nodes/[nodeId]/config` and the node caches it in `integration_credentials_cache`. `CORE_API_SECRET` on the node is kept as a legacy/dev fallback only.
- **Node optional**: `CORE_LOGIN_TIMEOUT_SECONDS`, `LESSON_COMPLETE_THRESHOLD`
- **Sync worker**: `MEDIA_DIR` (can be a network share like `V:/pulse`), `SYNC_BANDWIDTH_LIMIT_MBPS` (0 = unlimited)
- **Error tracking**: Optional `ERROR_WEBHOOK_URL` — when set, structured JSON error events POST here (with 30/min rate limit + 2s timeout). Falls back to stderr when unset.

## Database

- **Cloud**: Supabase Postgres with RLS. 13 migrations in `supabase/migrations/` (001-013). Run via SQL Editor.
  - 001: Initial schema (tenants, sites, nodes, users, classrooms, devices, assets, packages, sync_jobs, audit_logs, software_releases)
  - 005: Curriculum (grades, subjects, terms, class_groups, learning_sequences, quiz_definitions, student_profiles)
  - 006: Notifications + content scheduling
  - 009: Classroom schedules (schedule-based routing with recurrence)
  - 010: Alert subscriptions + permanent enrollment type
  - 011: `product_licenses` — per-tenant licensing for Pulse/SPARK/CORE/LIFT with plan + seats + expiry
  - 012: `class_groups.core_class_id` — CORE's canonical class identity stored for quick passthrough
  - 013: `tenant_integration_credentials` — per-tenant Bearer keys received from CORE when a license is provisioned
- **Local node**: SQLite via better-sqlite3. Schema auto-created on startup via `initDb()`.
  - Core tables: enrolled_devices, classroom_cache, local_packages, local_assets, student_sessions, conductor_state, local_quiz_attempts, cached_sequences
  - Prompt 10: lesson_completions (with sync_attempts, synced_to_core)
  - Prompt 11: classroom_schedule_cache, class_group_students_cache (with core_class_id column)
  - Session A: `integration_credentials_cache` (service → api_key + api_url, pushed from cloud config)
- **Cleanup**: `GET /api/cron/cleanup-metrics` deletes node_metrics, heartbeat events, and read notifications older than 30 days.

## Testing

```bash
pnpm test                                 # All 209 tests across 4 packages (via turbo)
pnpm test:ci                              # Verbose reporter for CI pipelines
pnpm test:coverage                        # Generate v8 coverage report
pnpm --filter @pulse/cloud-admin test     # Run single package tests
pnpm --filter @pulse/cloud-admin test:watch  # Watch mode for development
```

**Test structure (209 tests across 4 packages):**
- `packages/shared/__tests__/` — Shared types & constants (10 tests)
- `apps/cloud-admin/` — 155 tests covering API route handlers (register, heartbeat, sync enqueue/progress/complete, assets download-url, devices enrollment/revoke/rotate, node config, cron offline-nodes, tenant-isolation, node-auth, licenses, license-enforcement, core-credentials), pure functions (validate, heartbeat-alerts, manifest builder, checksum, licenses resolve/usable)
- `apps/node-agent/src/tests/` — Heartbeat payload builder, enrollment rate limiting, LWW conflict resolution (18 tests)
- `apps/sync-worker/src/tests/` — Worker cycle, downloader, throttle, integrity check (26 tests)

**Supabase mock layer** (`apps/cloud-admin/src/tests/mocks/supabase.ts`): Chainable query builder that mirrors the real Supabase API (`.from().select().eq().single()` etc). All test data lives in `mockSupabaseData` — use `seedMockData()` in `beforeEach` to set up state, `resetMockData()` clears between tests (automatic via setup.ts). Never hits a real database.

**Test fixtures** (`apps/cloud-admin/src/tests/fixtures/index.ts`): Factory functions for all entity types: `fixtures.node()`, `fixtures.asset()`, `fixtures.syncJob()`, etc. Accept overrides.

**Coverage thresholds** (cloud-admin): 60% lines, 60% functions, 50% branches.

**Known coverage gaps** documented in `apps/cloud-admin/src/tests/COVERAGE_GAPS.md`: React component rendering, E2E/Playwright, Jellyfin adapter integration, Docker startup, multi-tenant RLS verification.

## CI/CD

GitHub Actions pipelines in `.github/workflows/`:

**`ci.yml`** — Full CI/CD pipeline. Triggers on push to main/staging and PRs to main:
- **test** job: Builds shared → runs `test:ci` for cloud-admin, node-agent, sync-worker. Uploads coverage artifact.
- **typecheck** job: Runs `tsc --noEmit` on cloud-admin, node-agent, sync-worker (parallel with test).
- **build** job: Builds cloud-admin for production (runs only on main/staging, gated behind test + typecheck). Requires GitHub Actions secrets.
- **pr-comment** job: Posts coverage summary table on PRs.

**`docker-build.yml`** — Validates Docker image builds on push to main (does NOT push images).

**Vercel build gate** (`apps/cloud-admin/vercel.json`): Build command is `pnpm run test:ci && next build` — failed tests block deployment.

**Required GitHub Actions secrets** (documented in `.github/SECRETS.md`, gitignored):
`NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, `INTERNAL_API_SECRET`, `PULSE_NODE_SECRET`.

## Deployment

- **Cloud admin + landing page** → Vercel at `pulse.inteliflowai.com`. Root directory: `apps/cloud-admin`. Build gated behind tests via `vercel.json`: `pnpm --filter @pulse/shared build && pnpm run test:ci && next build`. Failed tests block deploy.
  - `/` → redirects to `/login`
  - `/pulse` → product landing page (animated demo, simulator, testimonials, FAQ)
  - `/login` → sliding background login page
  - `/dashboard/*` → platform dashboard
- **Marketing page (legacy)** → WordPress ReactPress at `inteliflowai.com/pulse`. CRA build in `marketing/`. Canonical version is now the Vercel-hosted `/pulse` route.
- **Node services** → Docker on school appliance (`docker/install.sh`), or directly via `pnpm dev`.
- **API docs** at `/api-docs` (no auth).
- **Health check** at `/api/health` (returns Supabase connectivity status).

## Integrations

In `apps/node-agent/src/integrations/`:
- `core-integration.ts` — Import quizzes from CORE, sync results back
- `spark-integration.ts` — Interactive assets (stubbed; no SPARK cloud routes built yet)
- `lms-sync.ts` — Batch sync quiz results + progress to cloud (5-min interval)

### CORE integration — current architecture (per `core/docs/pulse-integration.md`)

**Two-secret architecture:**
- **`CORE_PROVISIONING_SECRET`** — platform-wide, Vercel env on Pulse cloud only. Pulse uses it to call CORE's `POST /api/admin/platform-keys` when a super_admin provisions a CORE license. Never touches nodes.
- **Per-tenant Bearer key** — generated by CORE, returned to Pulse, stored in `tenant_integration_credentials`. Pushed to nodes via the config endpoint on every heartbeat cycle. Used as `Authorization: Bearer <key>` on all runtime CORE calls.

**Three-mode quiz handoff** (Pulse sends `student_id`? presence drives CORE's behavior):
- **`individual`** — student on laptop/home: CORE returns `quiz.quiz_url` with a 15-min signed JWT embedded. Classroom player opens the URL; student lands logged in via CORE's magic-link handoff page.
- **`class_fanout`** — shared STB: no student_id sent. CORE fans the quiz out to every enrolled student in the class. STB shows a "Quiz posted to CORE — open your device" notice. No redirect.
- **`pending`** — WAN down or CORE unreachable. Pulse shows "Quiz pending" holding screen. Lesson-complete stays queued locally; `lesson-complete-sync` worker retries every 5 min.

**Who owns what:**
- CORE owns: quizzes (authored by teacher inside CORE), grading, personalized homework generation (comprehension level + learning style → Learning Strategies + Power Skills), student accounts, classes/rosters
- Pulse owns: videos, playback, schedules, classroom STB delivery, lesson-complete event firing, per-tenant credential storage, node-side caching
- The `asset_id → quiz_id` mapping lives in CORE (`pulse_lesson_quiz_map`), seeded by the teacher when authoring a lesson in CORE. Pulse does not generate or pick quizzes.

**Runtime contract:**
- `POST {CORE_API_URL}/api/attempts/pulse-lesson-complete` — `Authorization: Bearer <per-tenant key>`, `watch_pct` as fraction (0..1), `core_class_id` passed through so CORE doesn't re-resolve Pulse's classroom_id
- `GET {CORE_API_URL}/api/attempts/pulse/export-classes` — imports CORE classes + students, stored as `class_groups.core_class_id`
- `POST {CORE_API_URL}/api/admin/platform-keys` — provision/list/delete per-school Bearer keys (cloud-admin only, with `X-Provisioning-Secret`)

**Offline fallback**: Dropped. CORE does adaptive diagnostic scoring that can't be approximated with a local 3-MCQ stub, and injecting fake answers would pollute CORE's dataset. Pending screen is the honest answer.

**Pending on CORE side (blocking `GET /api/videos` teacher UI):**
- Pulse needs to build `GET /api/videos` so CORE's lesson editor can let teachers pick Pulse videos when mapping to a quiz. Header: `X-Core-Secret` (platform-wide shared secret, different from per-tenant Bearer).

## Company Ops console (super_admin)

Inteliflow staff manage all customers from the `/dashboard/global/*` routes. Layout gates on `super_admin` via `requireRole()`.

- `/dashboard/global/customers` — tenant directory with site/node/user/license tallies + expiring-soon and expired badges. "New Customer" modal creates a tenant + invites an initial `tenant_admin`.
- `/dashboard/global/customers/[tenantId]` — per-customer detail: licenses, sites, nodes, users, recent activity. "Provision License" modal auto-generates the CORE Bearer key when product=core.
- `/dashboard/global/licenses` — cross-tenant license inventory with product/status filters.
- `/dashboard/global/fleet` — aggregate fleet dashboard: total schools, nodes online, storage, latest release rollout, recent alerts. 30-second refresh.
- `/dashboard/global/monitoring` — per-node fleet monitor (cards + table views).
- `/dashboard/global/api-test` — super_admin-only API health canary page. Fires 14 safe GET probes in parallel, reports status + latency. Post-deploy smoke test.
- `/dashboard/global/releases` — software release management.
- `/dashboard/settings/api-test` — per-role interactive API tester (any authenticated user), filtered to what the caller's role can actually call. Request/body editor + history.

Sidebar is grouped: **Company Ops** (super_admin only) → **Product Access** (customer-side pages) → **General** (Settings + API Test). Items with `productLicense?: Product` are auto-hidden when the tenant has no license, or shown with "expired" / "suspended" badges when present-but-unusable.

### License helpers
- `lib/licenses.ts` — `hasLicense(supabase, tenantId, product)` returns `active | trial | expired | suspended | missing`; `isLicenseUsable(state)` collapses to boolean. Used to gate `POST /api/class-groups/import-from-core` (402 Payment Required when CORE not licensed).
- `lib/use-licenses.ts` — React hook for the UI side: `useLicenses()` returns `{ state(p), usable(p), loading }`. During `loading`, treat products as not-usable to avoid flashing gated UI.
- `lib/core-provisioning.ts` — thin client for CORE's admin endpoints: `provisionPulseKey / deletePulseKey / listPulseKeys`.
- `lib/audit.ts` — `writeAuditLog(supabase, entry)` helper. Best-effort, non-blocking. Wired into user invite, device revoke/rotate, license provision/revoke/rotate.
- `lib/cron-auth.ts` — `isCronAuthorized(request)` — timing-safe compare against `CRON_SECRET` (replaces the old service-role-key-as-cron-secret anti-pattern).
- `lib/node-auth.ts` — `requireNodeToken(request, { expectedNodeId? })` — discriminated-union return so test mocks detect failures. Used by all node-facing routes.
- `lib/require-super-admin.ts` — same shape as `requireNodeToken`, gates `/dashboard/global/*` API routes.

### License auto-expiry
`GET /api/cron/expire-licenses` (daily, `CRON_SECRET`-gated) flips any active/trial license whose `expires_at` is in the past to `expired`. Audit-logged per row. Idempotent.

## Node Agent Features

- Auto-backup SQLite every 6h (`src/backup.ts`), max 10 retained, auto-verified via PRAGMA integrity_check
- Endpoints: `POST /backup`, `GET /backups`, `POST /restore`, `GET /backup/status`, `POST /backup/verify-latest`
- Update manager polls cloud every 10 min (`src/update-manager.ts`), respects maintenance windows
- Heartbeat with system metrics: CPU, memory, disk, sessions, devices (`src/heartbeat.ts`)
- Lesson-complete event system: fires on video end, syncs to CORE, uses per-tenant Bearer key from `integration_credentials_cache` (env-var fallback for dev)
- Lesson-complete sync worker: retries unsynced completions every 5 min
- Graceful shutdown: SIGTERM/SIGINT drain the HTTP server and clear intervals before exiting (10s hard-stop backstop)
- Idempotency middleware (`src/idempotency.ts`): `Idempotency-Key` header or `idempotency_key` body field caches successful responses for 10 min. Wired on `/lesson-complete` and `/quiz/submit`.
- LWW conflict resolution: `cached_sequences.cloud_updated_at` and `conductor_state.client_updated_at` reject stale writes via timestamp compare
- Jellyfin webhook handler: PlaybackStop → lesson-complete
- Schedule resolver: determines what content plays in each classroom based on time
- Schedule cache: synced from cloud on every heartbeat cycle
- Remote diagnostics collection: `POST /diagnostics/collect`
- Student session expiry (24h) with hourly cleanup
- Bandwidth throttling for sync downloads (`sync-worker/src/throttle.ts`)
- Static file serving from `public/` (Pulse logo for classroom player)
- Classroom events buffer: in-memory per-classroom event stream for player polling

## Node Agent Endpoints Summary

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | /health | none | Node status, WAN check |
| GET | /enroll?code= | none | Device enrollment (schedule-aware) |
| GET | /classroom?token= | session | Self-contained classroom player |
| GET | /classroom-status?token= | session | Package/asset counts |
| GET | /classroom-events?token= | session | Event stream (lesson_complete, etc.) |
| GET | /classroom/current-schedule?token= | session | Active/upcoming/day schedule |
| GET | /classroom/validate-student?token= | session | Class group membership check |
| POST | /lesson-complete | session | Fires lesson-complete event |
| GET | /conductor?token= | session | Teacher conductor page (mobile+desktop) |
| GET | /conductor/state?token= | session | Conductor state for student polling |
| POST | /conductor/update | session | Teacher pushes conductor state |
| POST | /conductor/end | session | End conductor session |
| GET | /packages?token= | session | Local package listing |
| GET | /sequences?token= | session | Learning sequences (cloud→cache fallback) |
| GET | /sequences/:seqId?token= | session | Single sequence with items |
| GET | /stream/:assetId?token= | session | Jellyfin stream redirect |
| POST | /students/login | session | Student login (student number) |
| POST | /students/logout | session | Clear student session |
| POST | /quiz/submit | session | Submit quiz answers |
| POST | /webhooks/jellyfin | none | Jellyfin PlaybackStop webhook |
| POST | /backup | none | Create backup |
| GET | /backups | none | List backups |
| POST | /restore | none | Restore from backup |
| GET | /backup/status | none | Backup status with verification |
| POST | /backup/verify-latest | none | Verify latest backup integrity |
| POST | /diagnostics/collect | X-Node-Token | Remote diagnostics collection |

## Legal

- Terms of Service at `/terms`
- Privacy Policy at `/privacy` (covers COPPA, FERPA, GDPR)
- Branded email templates in `supabase/email-templates/` (invite, reset password, confirm email)
