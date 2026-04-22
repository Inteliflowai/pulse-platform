-- ============================================================
-- 011: Product Licenses
-- Tracks which Inteliflow products each tenant is licensed for
-- (Pulse, SPARK, CORE, LIFT). Super admins provision; tenant admins
-- can read their own active licenses. Enforcement is opt-in per
-- feature — start by tracking; gate later.
-- ============================================================

CREATE TABLE product_licenses (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id   uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  product     text NOT NULL CHECK (product IN ('pulse', 'spark', 'core', 'lift')),
  plan        text NOT NULL DEFAULT 'starter'
              CHECK (plan IN ('trial', 'starter', 'professional', 'enterprise')),
  seats       int DEFAULT 0,                -- 0 = unlimited
  starts_at   timestamptz NOT NULL DEFAULT now(),
  expires_at  timestamptz,                   -- null = perpetual
  status      text NOT NULL DEFAULT 'active'
              CHECK (status IN ('active', 'expired', 'suspended', 'trial')),
  notes       text,
  metadata    jsonb DEFAULT '{}',
  created_at  timestamptz NOT NULL DEFAULT now(),
  created_by  uuid REFERENCES users(id),
  updated_at  timestamptz NOT NULL DEFAULT now()
);

-- A tenant only needs one license row per product at a time.
-- Renewals should update the existing row's expires_at rather than insert.
CREATE UNIQUE INDEX idx_product_licenses_tenant_product
  ON product_licenses(tenant_id, product);

CREATE INDEX idx_product_licenses_status
  ON product_licenses(status);

CREATE INDEX idx_product_licenses_expires_at
  ON product_licenses(expires_at)
  WHERE expires_at IS NOT NULL;

ALTER TABLE product_licenses ENABLE ROW LEVEL SECURITY;

-- Super admins manage all licenses.
CREATE POLICY "Super admins manage all licenses" ON product_licenses
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM users
      WHERE users.id = auth.uid()
      AND users.role = 'super_admin'
    )
  );

-- Tenant admins can read their own tenant's licenses (so the UI can
-- show "your org is licensed for SPARK"). They cannot mutate — only
-- Inteliflow staff provision.
CREATE POLICY "Tenant admins read own tenant licenses" ON product_licenses
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM users
      WHERE users.id = auth.uid()
      AND users.role IN ('tenant_admin', 'site_admin')
      AND users.tenant_id = product_licenses.tenant_id
    )
  );

-- Use the function defined in 001_pulse_initial.sql.
CREATE TRIGGER trg_product_licenses_updated_at
  BEFORE UPDATE ON product_licenses
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();
