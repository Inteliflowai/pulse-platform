-- ============================================================
-- Local Node Database Schema
-- ============================================================

CREATE TABLE IF NOT EXISTS local_sync_jobs (
  job_id       text PRIMARY KEY,  -- cloud job UUID
  package_id   text NOT NULL,
  status       text NOT NULL DEFAULT 'pending',
  manifest     jsonb,
  started_at   timestamptz,
  completed_at timestamptz,
  error        text,
  created_at   timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS local_assets (
  asset_id         text PRIMARY KEY,  -- cloud asset UUID
  filename         text NOT NULL,
  local_path       text,
  checksum         text,
  size_bytes       bigint,
  jellyfin_item_id text,
  status           text NOT NULL DEFAULT 'pending',
  created_at       timestamptz NOT NULL DEFAULT now(),
  updated_at       timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS local_packages (
  package_id  text PRIMARY KEY,  -- cloud package UUID
  name        text NOT NULL,
  version     text,
  manifest    jsonb,
  status      text NOT NULL DEFAULT 'synced',
  synced_at   timestamptz DEFAULT now()
);
