# Pulse

**Inteliflow Pulse** — school edge node + cloud control plane. Pulse provides local delivery of media, documents, and assignments to schools. It survives internet outages by serving content locally from an on-prem appliance and syncing back to the cloud when connectivity returns. The media engine is Jellyfin.

## Repo Structure

```
pulse/
  apps/
    cloud-admin/          # Next.js 14 app router — Vercel-deployed cloud UI + API
    node-agent/           # Node.js service that runs ON the school appliance
    jellyfin-adapter/     # Node.js service — wraps Jellyfin REST API for Pulse
    sync-worker/          # Node.js background worker — cloud-to-node sync engine
  packages/
    shared/               # Shared TypeScript types, schemas, constants
  docker/
    docker-compose.yml    # Full on-prem node stack
    docker-compose.dev.yml
  supabase/
    migrations/           # SQL migration files (cloud schema)
```

- **Monorepo** managed with pnpm workspaces + Turborepo
- **Cloud DB**: Supabase (Postgres + Auth + RLS)
- **On-prem DB**: Local Postgres 16 per node appliance
- **Media engine**: Jellyfin (wrapped via jellyfin-adapter)

## Prerequisites

- Node.js 20+
- pnpm 9+
- Docker & Docker Compose (for the on-prem node stack)
- A Supabase project (for cloud features)

## Local Dev Setup

```bash
# 1. Install dependencies
pnpm install

# 2. Copy env and fill in values
cp .env.example .env

# 3. Build shared package first
pnpm --filter @pulse/shared build

# 4. Run all apps in dev mode
pnpm dev
```

## Running the Cloud Admin Locally

```bash
pnpm --filter @pulse/cloud-admin dev
# Open http://localhost:3000
```

## Running the On-Prem Node Stack with Docker Compose

```bash
cd docker

# Copy env
cp ../.env.example .env
# Edit .env with your local values

# Start all services
docker compose up -d

# Dev mode (hot-reload, exposed Postgres)
docker compose -f docker-compose.yml -f docker-compose.dev.yml up

# View logs
docker compose logs -f node-agent
```

### Services

| Service          | Port | Description                     |
| ---------------- | ---- | ------------------------------- |
| jellyfin         | 8096 | Media server                    |
| postgres         | 5432 | Local node database (dev only)  |
| node-agent       | 3100 | On-prem orchestration agent     |
| jellyfin-adapter | 3101 | Jellyfin REST API wrapper       |
| sync-worker      | --   | Background cloud-to-node sync   |

## Supabase Migrations

Migration files are in `supabase/migrations/`. Apply them via the Supabase CLI:

```bash
supabase db push
```
