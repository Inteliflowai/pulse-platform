-- ============================================================
-- Pulse Initial Schema
-- ============================================================

-- 1. tenants
CREATE TABLE tenants (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name        text NOT NULL,
  slug        text NOT NULL UNIQUE,
  status      text NOT NULL DEFAULT 'active',
  metadata    jsonb DEFAULT '{}',
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE tenants ENABLE ROW LEVEL SECURITY;

-- 2. sites
CREATE TABLE sites (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id   uuid NOT NULL REFERENCES tenants(id),
  name        text NOT NULL,
  slug        text NOT NULL,
  address     text,
  timezone    text,
  status      text NOT NULL DEFAULT 'active',
  metadata    jsonb DEFAULT '{}',
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE sites ENABLE ROW LEVEL SECURITY;

-- 3. nodes
CREATE TABLE nodes (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  site_id             uuid NOT NULL REFERENCES sites(id),
  tenant_id           uuid NOT NULL REFERENCES tenants(id),
  name                text NOT NULL,
  hostname            text,
  status              text NOT NULL DEFAULT 'pending'
                      CHECK (status IN ('pending', 'active', 'offline', 'decommissioned')),
  version             text,
  last_seen_at        timestamptz,
  storage_total_gb    numeric,
  storage_used_gb     numeric,
  ip_address          text,
  registration_token  text UNIQUE,
  registered_at       timestamptz,
  metadata            jsonb DEFAULT '{}',
  created_at          timestamptz NOT NULL DEFAULT now(),
  updated_at          timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE nodes ENABLE ROW LEVEL SECURITY;

-- 4. users
CREATE TABLE users (
  id          uuid PRIMARY KEY,  -- matches auth.users
  tenant_id   uuid NOT NULL REFERENCES tenants(id),
  site_id     uuid REFERENCES sites(id),
  email       text NOT NULL UNIQUE,
  full_name   text,
  role        text NOT NULL
              CHECK (role IN ('super_admin', 'tenant_admin', 'site_admin', 'content_manager', 'teacher', 'student')),
  status      text NOT NULL DEFAULT 'active',
  metadata    jsonb DEFAULT '{}',
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE users ENABLE ROW LEVEL SECURITY;

-- 5. classrooms
CREATE TABLE classrooms (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  site_id     uuid NOT NULL REFERENCES sites(id),
  node_id     uuid REFERENCES nodes(id),
  name        text NOT NULL,
  room_code   text,
  capacity    int,
  status      text NOT NULL DEFAULT 'active',
  metadata    jsonb DEFAULT '{}',
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE classrooms ENABLE ROW LEVEL SECURITY;

-- 6. devices
CREATE TABLE devices (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  classroom_id      uuid REFERENCES classrooms(id),
  node_id           uuid NOT NULL REFERENCES nodes(id),
  tenant_id         uuid NOT NULL REFERENCES tenants(id),
  name              text NOT NULL,
  device_type       text NOT NULL
                    CHECK (device_type IN ('browser', 'stb', 'tv', 'tablet', 'laptop', 'other')),
  enrollment_token  text UNIQUE,
  status            text NOT NULL DEFAULT 'pending'
                    CHECK (status IN ('pending', 'enrolled', 'revoked')),
  last_seen_at      timestamptz,
  ip_address        text,
  metadata          jsonb DEFAULT '{}',
  created_at        timestamptz NOT NULL DEFAULT now(),
  updated_at        timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE devices ENABLE ROW LEVEL SECURITY;

-- 7. assets
CREATE TABLE assets (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id         uuid NOT NULL REFERENCES tenants(id),
  uploaded_by       uuid REFERENCES users(id),
  filename          text NOT NULL,
  original_filename text,
  mime_type         text,
  size_bytes        bigint,
  checksum          text,
  storage_path      text,
  jellyfin_item_id  text,
  status            text NOT NULL DEFAULT 'pending'
                    CHECK (status IN ('pending', 'processing', 'ready', 'error', 'deprecated')),
  metadata          jsonb DEFAULT '{}',
  created_at        timestamptz NOT NULL DEFAULT now(),
  updated_at        timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE assets ENABLE ROW LEVEL SECURITY;

-- 8. packages
CREATE TABLE packages (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id         uuid NOT NULL REFERENCES tenants(id),
  created_by        uuid REFERENCES users(id),
  name              text NOT NULL,
  description       text,
  version           text NOT NULL DEFAULT '1.0.0',
  status            text NOT NULL DEFAULT 'draft'
                    CHECK (status IN ('draft', 'published', 'deprecated')),
  manifest          jsonb,
  target_sites      jsonb DEFAULT '[]',
  total_size_bytes  bigint DEFAULT 0,
  metadata          jsonb DEFAULT '{}',
  created_at        timestamptz NOT NULL DEFAULT now(),
  updated_at        timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE packages ENABLE ROW LEVEL SECURITY;

-- 9. package_assets
CREATE TABLE package_assets (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  package_id  uuid NOT NULL REFERENCES packages(id),
  asset_id    uuid NOT NULL REFERENCES assets(id),
  sort_order  int NOT NULL DEFAULT 0,
  created_at  timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE package_assets ENABLE ROW LEVEL SECURITY;

-- 10. sync_jobs
CREATE TABLE sync_jobs (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  package_id        uuid NOT NULL REFERENCES packages(id),
  node_id           uuid NOT NULL REFERENCES nodes(id),
  status            text NOT NULL DEFAULT 'pending'
                    CHECK (status IN ('pending', 'in_progress', 'completed', 'failed', 'cancelled')),
  progress_pct      numeric NOT NULL DEFAULT 0,
  bytes_transferred bigint NOT NULL DEFAULT 0,
  bytes_total       bigint NOT NULL DEFAULT 0,
  retries           int NOT NULL DEFAULT 0,
  error_message     text,
  started_at        timestamptz,
  completed_at      timestamptz,
  metadata          jsonb DEFAULT '{}',
  created_at        timestamptz NOT NULL DEFAULT now(),
  updated_at        timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE sync_jobs ENABLE ROW LEVEL SECURITY;

-- 11. playback_sessions
CREATE TABLE playback_sessions (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  node_id           uuid NOT NULL REFERENCES nodes(id),
  device_id         uuid REFERENCES devices(id),
  asset_id          uuid NOT NULL REFERENCES assets(id),
  user_id           uuid REFERENCES users(id),
  started_at        timestamptz NOT NULL DEFAULT now(),
  ended_at          timestamptz,
  duration_seconds  int,
  status            text NOT NULL DEFAULT 'active'
                    CHECK (status IN ('active', 'completed', 'interrupted')),
  metadata          jsonb DEFAULT '{}',
  created_at        timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE playback_sessions ENABLE ROW LEVEL SECURITY;

-- 12. audit_logs
CREATE TABLE audit_logs (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id     uuid NOT NULL REFERENCES tenants(id),
  user_id       uuid REFERENCES users(id),
  node_id       uuid REFERENCES nodes(id),
  event_type    text NOT NULL,
  entity_type   text,
  entity_id     uuid,
  description   text,
  ip_address    text,
  metadata      jsonb DEFAULT '{}',
  created_at    timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE audit_logs ENABLE ROW LEVEL SECURITY;

-- 13. node_events
CREATE TABLE node_events (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  node_id     uuid NOT NULL REFERENCES nodes(id),
  event_type  text NOT NULL,
  severity    text NOT NULL DEFAULT 'info'
              CHECK (severity IN ('info', 'warning', 'error', 'critical')),
  message     text,
  metadata    jsonb DEFAULT '{}',
  created_at  timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE node_events ENABLE ROW LEVEL SECURITY;

-- 14. software_releases
CREATE TABLE software_releases (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  version        text NOT NULL UNIQUE,
  release_notes  text,
  download_url   text,
  checksum       text,
  status         text NOT NULL DEFAULT 'draft'
                 CHECK (status IN ('draft', 'staged', 'released', 'deprecated')),
  released_at    timestamptz,
  metadata       jsonb DEFAULT '{}',
  created_at     timestamptz NOT NULL DEFAULT now(),
  updated_at     timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE software_releases ENABLE ROW LEVEL SECURITY;

-- ============================================================
-- Indexes
-- ============================================================

-- tenant_id indexes
CREATE INDEX idx_sites_tenant_id ON sites(tenant_id);
CREATE INDEX idx_nodes_tenant_id ON nodes(tenant_id);
CREATE INDEX idx_users_tenant_id ON users(tenant_id);
CREATE INDEX idx_devices_tenant_id ON devices(tenant_id);
CREATE INDEX idx_assets_tenant_id ON assets(tenant_id);
CREATE INDEX idx_packages_tenant_id ON packages(tenant_id);
CREATE INDEX idx_audit_logs_tenant_id ON audit_logs(tenant_id);

-- site_id indexes
CREATE INDEX idx_nodes_site_id ON nodes(site_id);
CREATE INDEX idx_users_site_id ON users(site_id);
CREATE INDEX idx_classrooms_site_id ON classrooms(site_id);

-- node_id indexes
CREATE INDEX idx_classrooms_node_id ON classrooms(node_id);
CREATE INDEX idx_devices_node_id ON devices(node_id);
CREATE INDEX idx_sync_jobs_node_id ON sync_jobs(node_id);
CREATE INDEX idx_playback_sessions_node_id ON playback_sessions(node_id);
CREATE INDEX idx_audit_logs_node_id ON audit_logs(node_id);
CREATE INDEX idx_node_events_node_id ON node_events(node_id);

-- status indexes
CREATE INDEX idx_nodes_status ON nodes(status);
CREATE INDEX idx_devices_status ON devices(status);
CREATE INDEX idx_assets_status ON assets(status);
CREATE INDEX idx_packages_status ON packages(status);
CREATE INDEX idx_sync_jobs_status ON sync_jobs(status);
CREATE INDEX idx_playback_sessions_status ON playback_sessions(status);
CREATE INDEX idx_software_releases_status ON software_releases(status);

-- created_at indexes
CREATE INDEX idx_sync_jobs_created_at ON sync_jobs(created_at);
CREATE INDEX idx_playback_sessions_created_at ON playback_sessions(created_at);
CREATE INDEX idx_audit_logs_created_at ON audit_logs(created_at);
CREATE INDEX idx_node_events_created_at ON node_events(created_at);

-- ============================================================
-- updated_at trigger
-- ============================================================
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_tenants_updated_at BEFORE UPDATE ON tenants FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER trg_sites_updated_at BEFORE UPDATE ON sites FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER trg_nodes_updated_at BEFORE UPDATE ON nodes FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER trg_users_updated_at BEFORE UPDATE ON users FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER trg_classrooms_updated_at BEFORE UPDATE ON classrooms FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER trg_devices_updated_at BEFORE UPDATE ON devices FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER trg_assets_updated_at BEFORE UPDATE ON assets FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER trg_packages_updated_at BEFORE UPDATE ON packages FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER trg_sync_jobs_updated_at BEFORE UPDATE ON sync_jobs FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER trg_software_releases_updated_at BEFORE UPDATE ON software_releases FOR EACH ROW EXECUTE FUNCTION update_updated_at();
