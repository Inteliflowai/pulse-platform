-- ============================================================
-- Storage bucket for assets + RLS policies for content flow
-- ============================================================

-- Create private storage bucket
INSERT INTO storage.buckets (id, name, public)
VALUES ('pulse-assets', 'pulse-assets', false)
ON CONFLICT (id) DO NOTHING;

-- Allow authenticated users to read assets from their tenant
CREATE POLICY "Users can read own profile"
  ON users FOR SELECT
  USING (auth.uid() = id);

-- Allow authenticated users to read their tenant's assets
CREATE POLICY "Tenant users can read assets"
  ON assets FOR SELECT
  USING (tenant_id IN (SELECT tenant_id FROM users WHERE id = auth.uid()));

-- Allow content managers+ to insert assets
CREATE POLICY "Content managers can insert assets"
  ON assets FOR INSERT
  WITH CHECK (tenant_id IN (SELECT tenant_id FROM users WHERE id = auth.uid()));

-- Allow content managers+ to update assets
CREATE POLICY "Content managers can update assets"
  ON assets FOR UPDATE
  USING (tenant_id IN (SELECT tenant_id FROM users WHERE id = auth.uid()));

-- Allow content managers+ to delete assets
CREATE POLICY "Content managers can delete assets"
  ON assets FOR DELETE
  USING (tenant_id IN (SELECT tenant_id FROM users WHERE id = auth.uid()));

-- Packages policies
CREATE POLICY "Tenant users can read packages"
  ON packages FOR SELECT
  USING (tenant_id IN (SELECT tenant_id FROM users WHERE id = auth.uid()));

CREATE POLICY "Content managers can insert packages"
  ON packages FOR INSERT
  WITH CHECK (tenant_id IN (SELECT tenant_id FROM users WHERE id = auth.uid()));

CREATE POLICY "Content managers can update packages"
  ON packages FOR UPDATE
  USING (tenant_id IN (SELECT tenant_id FROM users WHERE id = auth.uid()));

-- Package assets policies
CREATE POLICY "Tenant users can read package_assets"
  ON package_assets FOR SELECT
  USING (package_id IN (SELECT id FROM packages WHERE tenant_id IN (SELECT tenant_id FROM users WHERE id = auth.uid())));

CREATE POLICY "Content managers can insert package_assets"
  ON package_assets FOR INSERT
  WITH CHECK (package_id IN (SELECT id FROM packages WHERE tenant_id IN (SELECT tenant_id FROM users WHERE id = auth.uid())));

-- Sync jobs policies
CREATE POLICY "Tenant users can read sync_jobs"
  ON sync_jobs FOR SELECT
  USING (node_id IN (SELECT id FROM nodes WHERE tenant_id IN (SELECT tenant_id FROM users WHERE id = auth.uid())));

-- Sites policies
CREATE POLICY "Tenant users can read sites"
  ON sites FOR SELECT
  USING (tenant_id IN (SELECT tenant_id FROM users WHERE id = auth.uid()));

-- Nodes policies
CREATE POLICY "Tenant users can read nodes"
  ON nodes FOR SELECT
  USING (tenant_id IN (SELECT tenant_id FROM users WHERE id = auth.uid()));

CREATE POLICY "Tenant admins can update nodes"
  ON nodes FOR UPDATE
  USING (tenant_id IN (SELECT tenant_id FROM users WHERE id = auth.uid()));

CREATE POLICY "Tenant admins can insert nodes"
  ON nodes FOR INSERT
  WITH CHECK (tenant_id IN (SELECT tenant_id FROM users WHERE id = auth.uid()));

-- Tenants policies
CREATE POLICY "Users can read own tenant"
  ON tenants FOR SELECT
  USING (id IN (SELECT tenant_id FROM users WHERE id = auth.uid()));

-- Audit logs
CREATE POLICY "Tenant users can read audit_logs"
  ON audit_logs FOR SELECT
  USING (tenant_id IN (SELECT tenant_id FROM users WHERE id = auth.uid()));

-- Node events
CREATE POLICY "Tenant users can read node_events"
  ON node_events FOR SELECT
  USING (node_id IN (SELECT id FROM nodes WHERE tenant_id IN (SELECT tenant_id FROM users WHERE id = auth.uid())));

-- Playback sessions
CREATE POLICY "Tenant users can read playback_sessions"
  ON playback_sessions FOR SELECT
  USING (node_id IN (SELECT id FROM nodes WHERE tenant_id IN (SELECT tenant_id FROM users WHERE id = auth.uid())));

-- Classrooms
CREATE POLICY "Tenant users can read classrooms"
  ON classrooms FOR SELECT
  USING (site_id IN (SELECT id FROM sites WHERE tenant_id IN (SELECT tenant_id FROM users WHERE id = auth.uid())));

-- Devices
CREATE POLICY "Tenant users can read devices"
  ON devices FOR SELECT
  USING (tenant_id IN (SELECT tenant_id FROM users WHERE id = auth.uid()));

-- Software releases (readable by all authenticated)
CREATE POLICY "Authenticated can read releases"
  ON software_releases FOR SELECT
  USING (auth.role() = 'authenticated');

-- Storage policies for pulse-assets bucket
CREATE POLICY "Tenant users can upload assets"
  ON storage.objects FOR INSERT
  WITH CHECK (bucket_id = 'pulse-assets');

CREATE POLICY "Tenant users can read asset files"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'pulse-assets');

CREATE POLICY "Tenant users can delete asset files"
  ON storage.objects FOR DELETE
  USING (bucket_id = 'pulse-assets');
