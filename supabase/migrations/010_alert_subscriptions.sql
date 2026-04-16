-- ============================================================
-- 010: Alert Subscriptions
-- Proactive alerting via email and webhooks.
-- ============================================================

CREATE TABLE alert_subscriptions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  tenant_id uuid NOT NULL REFERENCES tenants(id),
  alert_types jsonb NOT NULL DEFAULT '[]',
  channels jsonb NOT NULL DEFAULT '{"email": true}',
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE INDEX idx_alert_subs_tenant ON alert_subscriptions(tenant_id);
CREATE INDEX idx_alert_subs_user ON alert_subscriptions(user_id);

ALTER TABLE alert_subscriptions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage own alert subscriptions" ON alert_subscriptions
  FOR ALL USING (user_id = auth.uid());

CREATE POLICY "Admins view tenant subscriptions" ON alert_subscriptions
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM users
      WHERE users.id = auth.uid()
      AND users.role IN ('super_admin', 'tenant_admin')
      AND users.tenant_id = alert_subscriptions.tenant_id
    )
  );

-- Add enrollment_type to devices
ALTER TABLE devices ADD COLUMN IF NOT EXISTS enrollment_type text DEFAULT 'temporary'
  CHECK(enrollment_type IN ('temporary', 'permanent'));

CREATE TRIGGER set_updated_at_alert_subscriptions
  BEFORE UPDATE ON alert_subscriptions
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
