# Pulse

**Inteliflow Pulse** — school edge node + cloud control plane. Pulse provides local delivery of media, documents, and assignments to schools. It survives internet outages by serving content locally from an on-prem appliance and syncing back to the cloud when connectivity returns. The media engine is Jellyfin.

## Architecture

```
                        ┌─────────────────────────────────────┐
                        │          CLOUD (Vercel)              │
                        │  ┌──────────────────────────────┐   │
                        │  │  cloud-admin (Next.js 14)     │   │
                        │  │  - Dashboard UI               │   │
                        │  │  - API routes                 │   │
                        │  │  - Auth (Supabase)            │   │
                        │  └──────────┬───────────────────┘   │
                        │             │                        │
                        │  ┌──────────▼───────────────────┐   │
                        │  │  Supabase (Postgres + Auth)   │   │
                        │  │  - 14 tables + RLS            │   │
                        │  │  - Storage (pulse-assets)     │   │
                        │  └──────────────────────────────┘   │
                        └─────────────┬───────────────────────┘
                                      │ HTTPS (heartbeat, sync, enrollment)
                                      │
                  ┌───────────────────▼───────────────────────┐
                  │        SCHOOL NODE (on-prem appliance)     │
                  │                                            │
                  │  ┌─────────────┐  ┌────────────────────┐  │
                  │  │ node-agent  │  │  sync-worker        │  │
                  │  │ :3100       │  │  (background)       │  │
                  │  │ - enrollment│  │  - poll cloud       │  │
                  │  │ - streaming │  │  - download assets  │  │
                  │  │ - heartbeat │  │  - checksum verify  │  │
                  │  └──────┬──────┘  └────────┬───────────┘  │
                  │         │                  │               │
                  │  ┌──────▼──────────────────▼───────────┐  │
                  │  │  jellyfin-adapter :3101              │  │
                  │  │  - asset registration                │  │
                  │  │  - stream URL generation             │  │
                  │  └──────────────┬───────────────────────┘  │
                  │                 │                           │
                  │  ┌──────────────▼──────────────────────┐   │
                  │  │  Jellyfin :8096                      │   │
                  │  │  - Media server                      │   │
                  │  └─────────────────────────────────────┘   │
                  │                                            │
                  │  ┌─────────────────────────────────────┐   │
                  │  │  SQLite (local persistence)          │   │
                  │  └─────────────────────────────────────┘   │
                  └────────────────────────────────────────────┘
```

## Repo Structure

```
pulse/
  apps/
    cloud-admin/          # Next.js 14 — Vercel-deployed cloud UI + API
    node-agent/           # Express — runs ON the school appliance (:3100)
    jellyfin-adapter/     # Express — wraps Jellyfin REST API (:3101)
    sync-worker/          # Background worker — cloud-to-node sync engine
  packages/
    shared/               # Shared TypeScript types, schemas, constants
  docker/
    docker-compose.yml    # Full on-prem node stack
    docker-compose.dev.yml
    install.sh            # One-line installer for school nodes
  supabase/
    migrations/           # SQL migration files (001-004)
  scripts/                # Dev utility scripts
```

## Prerequisites

- Node.js 20+
- pnpm 9+
- A Supabase project (for cloud features)
- Jellyfin server (on the school network)

## Local Dev Setup

```bash
# 1. Install dependencies
pnpm install

# 2. Copy env and fill in values
cp .env.example .env
# Also create: apps/cloud-admin/.env.local, apps/node-agent/.env,
#              apps/jellyfin-adapter/.env, apps/sync-worker/.env

# 3. Build shared package
pnpm --filter @pulse/shared build

# 4. Seed admin user
npx tsx scripts/seed-admin.ts

# 5. Run all apps in dev mode
pnpm dev
```

## Services (Dev Mode)

| Service          | Port | Description                     |
| ---------------- | ---- | ------------------------------- |
| cloud-admin      | 3000 | Cloud dashboard + API           |
| node-agent       | 3100 | On-prem orchestration agent     |
| jellyfin-adapter | 3101 | Jellyfin REST API wrapper       |
| sync-worker      | 3200 | Sync engine (health endpoint)   |
| Jellyfin         | 8096 | Media server (external)         |

## Deploying a School Node

### Quick install (Linux with Docker):
```bash
curl -fsSL https://pulse.inteliflowai.com/install.sh | bash -s -- --token YOUR_TOKEN
```

### Manual setup:
1. Provision a node in the cloud admin (/dashboard/global/nodes/new)
2. Copy the registration token
3. Set up env vars on the node machine
4. Run node-agent, jellyfin-adapter, and sync-worker
5. The node auto-registers on first heartbeat

## Supabase Migrations

Run migrations in order via the Supabase SQL Editor:
- `001_pulse_initial.sql` — core schema (14 tables)
- `002_storage_and_policies.sql` — storage bucket + RLS policies
- `003_classroom_device_policies.sql` — classroom/device policies
- `004_observability.sql` — node_metrics + software_update_assignments

## Beta Deployment Checklist

- [ ] Supabase project created with all migrations applied
- [ ] Admin user seeded (`npx tsx scripts/seed-admin.ts`)
- [ ] Cloud admin deployed to Vercel with env vars
- [ ] At least one tenant + site created
- [ ] Node provisioned and registered
- [ ] Jellyfin server running with API key configured
- [ ] Media directory shared/accessible from sync worker
- [ ] Test: upload asset, create package, publish, push sync
- [ ] Test: verify video appears in Jellyfin after sync
- [ ] Test: enroll a device, play content from classroom player
- [ ] Monitoring: verify heartbeats appear in dashboard
