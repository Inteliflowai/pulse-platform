-- ============================================================
-- Notifications + Content Scheduling
-- ============================================================

CREATE TABLE notifications (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id   uuid NOT NULL REFERENCES tenants(id),
  user_id     uuid REFERENCES users(id),
  type        text NOT NULL,
  title       text NOT NULL,
  message     text,
  link        text,
  read        boolean DEFAULT false,
  metadata    jsonb DEFAULT '{}',
  created_at  timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;
CREATE INDEX idx_notifications_user ON notifications(user_id, read, created_at);

CREATE POLICY "Users can read own notifications"
  ON notifications FOR SELECT
  USING (user_id = auth.uid() OR user_id IS NULL);

CREATE POLICY "Users can update own notifications"
  ON notifications FOR UPDATE
  USING (user_id = auth.uid());

-- Content scheduling: add publish/expire dates to packages
ALTER TABLE packages ADD COLUMN IF NOT EXISTS publish_at timestamptz;
ALTER TABLE packages ADD COLUMN IF NOT EXISTS expire_at timestamptz;

-- Add scheduling to sequences
ALTER TABLE learning_sequences ADD COLUMN IF NOT EXISTS publish_at timestamptz;
ALTER TABLE learning_sequences ADD COLUMN IF NOT EXISTS expire_at timestamptz;
