-- ============================================================
-- Observability: node_metrics + software_update_assignments
-- ============================================================

CREATE TABLE node_metrics (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  node_id           uuid NOT NULL REFERENCES nodes(id),
  recorded_at       timestamptz NOT NULL DEFAULT now(),
  cpu_pct           numeric,
  memory_used_gb    numeric,
  memory_total_gb   numeric,
  storage_used_gb   numeric,
  storage_total_gb  numeric,
  active_sessions   int DEFAULT 0,
  enrolled_devices  int DEFAULT 0,
  pending_sync_jobs int DEFAULT 0,
  wan_connected     boolean DEFAULT true,
  jellyfin_reachable boolean DEFAULT true
);
ALTER TABLE node_metrics ENABLE ROW LEVEL SECURITY;

CREATE INDEX idx_node_metrics_node_recorded ON node_metrics(node_id, recorded_at);
CREATE INDEX idx_node_metrics_recorded_at ON node_metrics(recorded_at);

CREATE TABLE software_update_assignments (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  release_id    uuid NOT NULL REFERENCES software_releases(id),
  node_id       uuid NOT NULL REFERENCES nodes(id),
  status        text NOT NULL DEFAULT 'pending'
                CHECK (status IN ('pending','downloading','applying','completed','failed','rolled_back')),
  assigned_at   timestamptz DEFAULT now(),
  completed_at  timestamptz,
  error         text,
  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE software_update_assignments ENABLE ROW LEVEL SECURITY;

CREATE INDEX idx_update_assignments_node ON software_update_assignments(node_id);
CREATE INDEX idx_update_assignments_release ON software_update_assignments(release_id);

-- Additional indexes for observability queries
CREATE INDEX idx_node_events_severity ON node_events(severity);
CREATE INDEX idx_node_events_node_severity ON node_events(node_id, severity, created_at);

-- RLS policies
CREATE POLICY "Tenant users can read node_metrics"
  ON node_metrics FOR SELECT
  USING (node_id IN (SELECT id FROM nodes WHERE tenant_id IN (SELECT tenant_id FROM users WHERE id = auth.uid())));

CREATE POLICY "Tenant users can read update_assignments"
  ON software_update_assignments FOR SELECT
  USING (node_id IN (SELECT id FROM nodes WHERE tenant_id IN (SELECT tenant_id FROM users WHERE id = auth.uid())));

CREATE POLICY "Admins can insert software_releases"
  ON software_releases FOR INSERT
  WITH CHECK (auth.role() = 'authenticated');

CREATE POLICY "Admins can update software_releases"
  ON software_releases FOR UPDATE
  USING (auth.role() = 'authenticated');

-- updated_at trigger for update_assignments
CREATE TRIGGER trg_update_assignments_updated_at
  BEFORE UPDATE ON software_update_assignments
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();
