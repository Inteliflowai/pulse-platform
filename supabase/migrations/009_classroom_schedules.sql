-- ============================================================
-- 009: Classroom Schedules
-- Adds schedule-based routing: which STB plays what content
-- for which students at what time.
-- ============================================================

-- Classroom schedules table
CREATE TABLE classroom_schedules (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  classroom_id uuid NOT NULL REFERENCES classrooms(id) ON DELETE CASCADE,
  class_group_id uuid NOT NULL REFERENCES class_groups(id) ON DELETE CASCADE,
  sequence_id uuid NOT NULL REFERENCES learning_sequences(id) ON DELETE CASCADE,
  teacher_id uuid REFERENCES users(id) ON DELETE SET NULL,
  site_id uuid NOT NULL REFERENCES sites(id),
  tenant_id uuid NOT NULL REFERENCES tenants(id),

  -- Scheduling
  scheduled_date date,
  scheduled_time time NOT NULL,
  duration_minutes int NOT NULL DEFAULT 60,
  recurrence text DEFAULT 'once'
    CHECK(recurrence IN ('once','daily','weekly','weekdays','custom')),
  recurrence_days jsonb DEFAULT '[]',
  recurrence_end_date date,

  -- State
  status text DEFAULT 'scheduled'
    CHECK(status IN ('scheduled','active','completed','cancelled')),
  started_at timestamptz,
  ended_at timestamptz,

  -- Metadata
  notes text,
  metadata jsonb,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE INDEX idx_schedules_classroom ON classroom_schedules(classroom_id, status);
CREATE INDEX idx_schedules_time ON classroom_schedules(scheduled_time, recurrence);
CREATE INDEX idx_schedules_tenant ON classroom_schedules(tenant_id);
CREATE INDEX idx_schedules_teacher ON classroom_schedules(teacher_id);
CREATE INDEX idx_schedules_date ON classroom_schedules(scheduled_date, status);

-- Enable RLS
ALTER TABLE classroom_schedules ENABLE ROW LEVEL SECURITY;

-- Super admin: full access
CREATE POLICY "super_admin_schedules" ON classroom_schedules
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM users
      WHERE users.id = auth.uid()
      AND users.role = 'super_admin'
    )
  );

-- Tenant/site admins: manage all schedules for their tenant
CREATE POLICY "admin_schedules" ON classroom_schedules
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM users
      WHERE users.id = auth.uid()
      AND users.role IN ('tenant_admin', 'site_admin')
      AND users.tenant_id = classroom_schedules.tenant_id
    )
  );

-- Teachers: manage their own schedules
CREATE POLICY "teacher_own_schedules" ON classroom_schedules
  FOR ALL USING (
    teacher_id = auth.uid()
  );

-- Content managers: read all schedules for their tenant
CREATE POLICY "content_manager_read_schedules" ON classroom_schedules
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM users
      WHERE users.id = auth.uid()
      AND users.role = 'content_manager'
      AND users.tenant_id = classroom_schedules.tenant_id
    )
  );

-- Updated_at trigger
CREATE TRIGGER set_updated_at_classroom_schedules
  BEFORE UPDATE ON classroom_schedules
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
