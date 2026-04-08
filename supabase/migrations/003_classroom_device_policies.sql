-- RLS policies for classrooms and devices management

-- Classrooms insert for tenant users
CREATE POLICY "Tenant users can insert classrooms"
  ON classrooms FOR INSERT
  WITH CHECK (site_id IN (SELECT id FROM sites WHERE tenant_id IN (SELECT tenant_id FROM users WHERE id = auth.uid())));

-- Classrooms update
CREATE POLICY "Tenant users can update classrooms"
  ON classrooms FOR UPDATE
  USING (site_id IN (SELECT id FROM sites WHERE tenant_id IN (SELECT tenant_id FROM users WHERE id = auth.uid())));

-- Devices insert
CREATE POLICY "Tenant users can insert devices"
  ON devices FOR INSERT
  WITH CHECK (tenant_id IN (SELECT tenant_id FROM users WHERE id = auth.uid()));

-- Devices update
CREATE POLICY "Tenant users can update devices"
  ON devices FOR UPDATE
  USING (tenant_id IN (SELECT tenant_id FROM users WHERE id = auth.uid()));

-- Users update (for role changes)
CREATE POLICY "Tenant admins can update users"
  ON users FOR UPDATE
  USING (tenant_id IN (SELECT tenant_id FROM users WHERE id = auth.uid()));

-- Users insert (for invites)
CREATE POLICY "Tenant admins can insert users"
  ON users FOR INSERT
  WITH CHECK (tenant_id IN (SELECT tenant_id FROM users WHERE id = auth.uid()));

-- Audit logs insert
CREATE POLICY "Tenant users can insert audit_logs"
  ON audit_logs FOR INSERT
  WITH CHECK (tenant_id IN (SELECT tenant_id FROM users WHERE id = auth.uid()));
