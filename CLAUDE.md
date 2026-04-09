# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What is Pulse

Pulse is Inteliflow's school edge-node + cloud control plane. It delivers media, documents, and assignments to schools via on-prem appliances that survive internet outages, syncing to cloud when connectivity returns. The media engine is Jellyfin (wrapped, not replaced).

## Build & Dev Commands

```bash
# Install dependencies
pnpm install

# Build shared package (MUST run before other builds — Turbo handles this automatically)
pnpm --filter @pulse/shared build

# Build everything
pnpm build

# Run all services in dev mode
pnpm dev

# Run a single app
pnpm --filter @pulse/cloud-admin dev
pnpm --filter @pulse/node-agent dev
pnpm --filter @pulse/jellyfin-adapter dev
pnpm --filter @pulse/sync-worker dev

# Build a single app
pnpm --filter @pulse/cloud-admin build

# Clean Next.js cache (do this when you get stale 404s or route issues)
rm -rf apps/cloud-admin/.next

# Seed admin user (requires .env with Supabase keys)
npx tsx scripts/seed-admin.ts
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

- `apps/cloud-admin` — Next.js 14 app router deployed to Vercel. Dashboard UI + all API routes. Uses Supabase for auth, DB, and file storage.
- `apps/node-agent` — Express service running on the school appliance. Handles device enrollment, classroom player (self-contained offline HTML), stream routing through Jellyfin adapter, heartbeats to cloud.
- `apps/jellyfin-adapter` — Express service wrapping Jellyfin's REST API. Only interface to Jellyfin — no other service calls Jellyfin directly.
- `apps/sync-worker` — Background worker on the appliance. Polls cloud for sync jobs, downloads assets via signed URLs, verifies checksums, copies to Jellyfin media directory.
- `packages/shared` — TypeScript types, enums, and constants shared across all apps. Must build before apps.

## Key Patterns

### Supabase Clients (cloud-admin only)
Three client types in `apps/cloud-admin/src/lib/supabase/`:
- `browser.ts` — `createBrowserClient` for client components (anon key)
- `server.ts` — `createServerClient` for server components/route handlers (anon key + cookies). The function is `async` because `cookies()` requires `await`.
- `admin.ts` — `createAdminSupabaseClient` using service role key. **NOT async**. Bypasses RLS. Used in API routes that need unrestricted DB access.

### Next.js Route Handlers
Dynamic params are Promises in Next.js 14: `const { id } = await params;`
All API routes return `{ error: string }` on failure with appropriate HTTP status.

### SQLite on Node Services
Both node-agent and sync-worker use `better-sqlite3` with WAL mode. DB files live in `apps/{service}/data/`. Functions are **synchronous** (not async) — don't use `.catch()` on return values, use try/catch instead.

### Offline-First Design
Node services must gracefully handle cloud unreachability. Use `AbortSignal.timeout()` on fetch calls to cloud. Fall back to local SQLite data. Never crash on WAN failure.

### Cross-Device File Moves
When moving files between drives (e.g., local disk to network share), `renameSync` fails with `EXDEV`. The `moveFile` helper in `sync-worker/src/downloader.ts` falls back to copy+delete.

### Multi-Tenant Isolation
Every Supabase query touching tenant data must include a `tenant_id` filter. RLS policies enforce this at the DB level, but queries should still be explicit.

## Environment Setup

Each app has its own `.env` file (gitignored). The cloud-admin also needs `.env.local` for Next.js to pick up `NEXT_PUBLIC_*` vars. Key variables:

- **Cloud**: `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`
- **Node services**: `NODE_ID`, `NODE_REGISTRATION_TOKEN`, `CLOUD_API_URL`, `JELLYFIN_BASE_URL`, `JELLYFIN_API_KEY`
- **Sync worker**: `MEDIA_DIR` (where downloaded files go — can be a network share like `V:/pulse`)

## Database

- **Cloud**: Supabase Postgres with RLS. Migrations in `supabase/migrations/` (001-005). Run via Supabase SQL Editor.
- **Local node**: SQLite via better-sqlite3. Schema auto-created on startup via `initDb()`. DB files in `apps/{service}/data/`.

## Deployment

- **Cloud admin** → Vercel. Root directory: `apps/cloud-admin`. Build command: `cd ../.. && pnpm install && pnpm --filter @pulse/shared build && pnpm --filter @pulse/cloud-admin build`
- **Node services** → Docker on school appliance, or directly via `pnpm dev` for development.
