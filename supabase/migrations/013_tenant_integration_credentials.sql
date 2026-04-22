-- ============================================================
-- 013: Tenant integration credentials
--
-- Stores the per-tenant Bearer keys Pulse receives from CORE (and
-- eventually SPARK/LIFT) when an Inteliflow super_admin provisions an
-- integration license. One row per (tenant_id, service).
--
-- Lifecycle:
--   1. super_admin creates a product_license (product='core')
--   2. Pulse cloud calls CORE's POST /api/admin/platform-keys
--   3. CORE returns { id, api_key }; Pulse stores them here
--   4. node-agent fetches the api_key via /api/nodes/[nodeId]/config
--      and sends it on every lesson-complete call
--   5. on license suspend or rotate, Pulse calls CORE's DELETE with the
--      stored provider_row_id
--
-- Kept separate from product_licenses so a license can exist without a
-- credential yet (CORE_PROVISIONING_SECRET not configured, CORE endpoint
-- down, etc.) — the UI shows "not provisioned" and offers a manual retry.
-- ============================================================

CREATE TABLE tenant_integration_credentials (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id         uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  service           text NOT NULL CHECK (service IN ('core', 'spark', 'lift')),

  -- The Bearer key Pulse sends on every runtime call for this tenant.
  -- Plaintext at rest; same trust model as nodes.registration_token.
  api_key           text,

  -- Optional override for the service's base URL. NULL means use the
  -- platform default (CORE_API_URL env var for core).
  api_url           text,

  -- The provider-side row UUID (CORE's platform_api_keys.id for core).
  -- Needed for DELETE /api/admin/platform-keys/{id} during rotation.
  provider_row_id   text,

  status            text NOT NULL DEFAULT 'not_provisioned'
                    CHECK (status IN ('active', 'not_provisioned', 'revoked', 'rotating')),

  label             text,
  last_used_at      timestamptz,
  last_error        text,
  metadata          jsonb DEFAULT '{}',

  created_at        timestamptz NOT NULL DEFAULT now(),
  created_by        uuid REFERENCES users(id),
  updated_at        timestamptz NOT NULL DEFAULT now(),
  revoked_at        timestamptz,
  revoked_by        uuid REFERENCES users(id),

  -- One active credential per (tenant, service). Rotations update in place.
  UNIQUE (tenant_id, service)
);

CREATE INDEX idx_tic_tenant       ON tenant_integration_credentials(tenant_id);
CREATE INDEX idx_tic_status       ON tenant_integration_credentials(status);
CREATE INDEX idx_tic_service      ON tenant_integration_credentials(service);

ALTER TABLE tenant_integration_credentials ENABLE ROW LEVEL SECURITY;

-- Only super_admin can read/write credentials directly via RLS. The node
-- config endpoint uses the service role (createAdminSupabaseClient) and
-- bypasses RLS — that's the intended access path for nodes.
CREATE POLICY "super_admins manage all credentials"
  ON tenant_integration_credentials FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM users
      WHERE users.id = auth.uid()
      AND users.role = 'super_admin'
    )
  );

CREATE TRIGGER trg_tic_updated_at
  BEFORE UPDATE ON tenant_integration_credentials
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();
