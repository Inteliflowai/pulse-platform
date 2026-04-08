-- ============================================================
-- Phase 3: Curriculum, Sequenced Learning, Quiz Engine
-- ============================================================

-- Grades (Grade 1, Grade 2, etc.)
CREATE TABLE grades (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id   uuid NOT NULL REFERENCES tenants(id),
  name        text NOT NULL,
  sort_order  int DEFAULT 0,
  metadata    jsonb DEFAULT '{}',
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE grades ENABLE ROW LEVEL SECURITY;
CREATE INDEX idx_grades_tenant ON grades(tenant_id);

-- Subjects (Math, Science, English, etc.)
CREATE TABLE subjects (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id   uuid NOT NULL REFERENCES tenants(id),
  name        text NOT NULL,
  code        text,
  color       text DEFAULT '#6366f1',
  metadata    jsonb DEFAULT '{}',
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE subjects ENABLE ROW LEVEL SECURITY;
CREATE INDEX idx_subjects_tenant ON subjects(tenant_id);

-- Terms (Term 1 2026, Semester A, etc.)
CREATE TABLE terms (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id   uuid NOT NULL REFERENCES tenants(id),
  name        text NOT NULL,
  start_date  date,
  end_date    date,
  is_active   boolean DEFAULT false,
  metadata    jsonb DEFAULT '{}',
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE terms ENABLE ROW LEVEL SECURITY;
CREATE INDEX idx_terms_tenant ON terms(tenant_id);

-- Class groups (Grade 10A Science, etc.)
CREATE TABLE class_groups (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id     uuid NOT NULL REFERENCES tenants(id),
  site_id       uuid REFERENCES sites(id),
  classroom_id  uuid REFERENCES classrooms(id),
  grade_id      uuid NOT NULL REFERENCES grades(id),
  subject_id    uuid NOT NULL REFERENCES subjects(id),
  term_id       uuid REFERENCES terms(id),
  name          text NOT NULL,
  teacher_id    uuid REFERENCES users(id),
  status        text DEFAULT 'active',
  metadata      jsonb DEFAULT '{}',
  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE class_groups ENABLE ROW LEVEL SECURITY;
CREATE INDEX idx_class_groups_tenant ON class_groups(tenant_id);
CREATE INDEX idx_class_groups_grade ON class_groups(grade_id);
CREATE INDEX idx_class_groups_subject ON class_groups(subject_id);

-- Student profiles (extends users)
CREATE TABLE student_profiles (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id       uuid NOT NULL REFERENCES users(id),
  tenant_id     uuid NOT NULL REFERENCES tenants(id),
  grade_id      uuid REFERENCES grades(id),
  student_number text,
  date_of_birth date,
  metadata      jsonb DEFAULT '{}',
  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE student_profiles ENABLE ROW LEVEL SECURITY;
CREATE INDEX idx_student_profiles_user ON student_profiles(user_id);
CREATE INDEX idx_student_profiles_grade ON student_profiles(grade_id);

-- Class group membership
CREATE TABLE class_group_students (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  class_group_id  uuid NOT NULL REFERENCES class_groups(id),
  student_id      uuid NOT NULL REFERENCES student_profiles(id),
  enrolled_at     timestamptz DEFAULT now(),
  status          text DEFAULT 'active',
  UNIQUE(class_group_id, student_id)
);
ALTER TABLE class_group_students ENABLE ROW LEVEL SECURITY;
CREATE INDEX idx_cgs_class_group ON class_group_students(class_group_id);
CREATE INDEX idx_cgs_student ON class_group_students(student_id);

-- Learning sequences (ordered: video → quiz → video → quiz)
CREATE TABLE learning_sequences (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id     uuid NOT NULL REFERENCES tenants(id),
  package_id    uuid REFERENCES packages(id),
  grade_id      uuid REFERENCES grades(id),
  subject_id    uuid REFERENCES subjects(id),
  term_id       uuid REFERENCES terms(id),
  name          text NOT NULL,
  description   text,
  created_by    uuid REFERENCES users(id),
  status        text DEFAULT 'draft' CHECK (status IN ('draft','published','archived')),
  metadata      jsonb DEFAULT '{}',
  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE learning_sequences ENABLE ROW LEVEL SECURITY;
CREATE INDEX idx_sequences_tenant ON learning_sequences(tenant_id);
CREATE INDEX idx_sequences_grade_subject ON learning_sequences(grade_id, subject_id);

-- Sequence items (each step: video, quiz, document, interactive)
CREATE TABLE sequence_items (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  sequence_id   uuid NOT NULL REFERENCES learning_sequences(id) ON DELETE CASCADE,
  sort_order    int NOT NULL DEFAULT 0,
  item_type     text NOT NULL CHECK (item_type IN ('video','quiz','document','interactive','break')),
  title         text NOT NULL,
  -- For video/document: links to asset
  asset_id      uuid REFERENCES assets(id),
  -- For quiz: links to quiz definition
  quiz_id       uuid,  -- FK added after quiz_definitions created
  -- Config
  duration_minutes int,
  auto_advance  boolean DEFAULT true,
  require_completion boolean DEFAULT true,
  metadata      jsonb DEFAULT '{}',
  created_at    timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE sequence_items ENABLE ROW LEVEL SECURITY;
CREATE INDEX idx_sequence_items_seq ON sequence_items(sequence_id, sort_order);

-- Quiz definitions (from CORE or created in Pulse)
CREATE TABLE quiz_definitions (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id     uuid NOT NULL REFERENCES tenants(id),
  sequence_id   uuid REFERENCES learning_sequences(id),
  title         text NOT NULL,
  description   text,
  time_limit_minutes int,
  pass_percentage numeric DEFAULT 50,
  max_attempts  int DEFAULT 1,
  shuffle_questions boolean DEFAULT false,
  show_results  boolean DEFAULT true,
  created_by    uuid REFERENCES users(id),
  source        text DEFAULT 'pulse' CHECK (source IN ('pulse','core','spark')),
  external_id   text,  -- ID in CORE/SPARK system
  status        text DEFAULT 'draft' CHECK (status IN ('draft','published','archived')),
  metadata      jsonb DEFAULT '{}',
  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE quiz_definitions ENABLE ROW LEVEL SECURITY;
CREATE INDEX idx_quiz_defs_tenant ON quiz_definitions(tenant_id);

-- Add FK from sequence_items to quiz_definitions
ALTER TABLE sequence_items ADD CONSTRAINT fk_sequence_items_quiz
  FOREIGN KEY (quiz_id) REFERENCES quiz_definitions(id);

-- Quiz questions
CREATE TABLE quiz_questions (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  quiz_id       uuid NOT NULL REFERENCES quiz_definitions(id) ON DELETE CASCADE,
  sort_order    int NOT NULL DEFAULT 0,
  question_type text NOT NULL CHECK (question_type IN ('multiple_choice','true_false','short_answer','matching','ordering')),
  question_text text NOT NULL,
  options       jsonb DEFAULT '[]',   -- [{id, text, is_correct}]
  correct_answer text,                -- for short_answer
  points        numeric DEFAULT 1,
  explanation   text,
  media_asset_id uuid REFERENCES assets(id),
  metadata      jsonb DEFAULT '{}',
  created_at    timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE quiz_questions ENABLE ROW LEVEL SECURITY;
CREATE INDEX idx_quiz_questions_quiz ON quiz_questions(quiz_id, sort_order);

-- Quiz attempts (student taking a quiz)
CREATE TABLE quiz_attempts (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  quiz_id       uuid NOT NULL REFERENCES quiz_definitions(id),
  student_id    uuid NOT NULL REFERENCES student_profiles(id),
  node_id       uuid REFERENCES nodes(id),
  device_id     uuid REFERENCES devices(id),
  attempt_number int DEFAULT 1,
  started_at    timestamptz DEFAULT now(),
  completed_at  timestamptz,
  score         numeric,
  max_score     numeric,
  percentage    numeric,
  passed        boolean,
  status        text DEFAULT 'in_progress' CHECK (status IN ('in_progress','completed','abandoned','timed_out')),
  synced_to_cloud boolean DEFAULT false,
  metadata      jsonb DEFAULT '{}',
  created_at    timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE quiz_attempts ENABLE ROW LEVEL SECURITY;
CREATE INDEX idx_quiz_attempts_student ON quiz_attempts(student_id);
CREATE INDEX idx_quiz_attempts_quiz ON quiz_attempts(quiz_id);

-- Quiz responses (individual answers)
CREATE TABLE quiz_responses (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  attempt_id    uuid NOT NULL REFERENCES quiz_attempts(id) ON DELETE CASCADE,
  question_id   uuid NOT NULL REFERENCES quiz_questions(id),
  answer        text,
  answer_data   jsonb,  -- for complex answer types
  is_correct    boolean,
  points_earned numeric DEFAULT 0,
  time_spent_seconds int,
  created_at    timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE quiz_responses ENABLE ROW LEVEL SECURITY;
CREATE INDEX idx_quiz_responses_attempt ON quiz_responses(attempt_id);

-- Student progress tracking
CREATE TABLE student_progress (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id    uuid NOT NULL REFERENCES student_profiles(id),
  sequence_id   uuid NOT NULL REFERENCES learning_sequences(id),
  sequence_item_id uuid REFERENCES sequence_items(id),
  class_group_id uuid REFERENCES class_groups(id),
  node_id       uuid REFERENCES nodes(id),
  status        text DEFAULT 'not_started' CHECK (status IN ('not_started','in_progress','completed','skipped')),
  started_at    timestamptz,
  completed_at  timestamptz,
  watch_time_seconds int DEFAULT 0,
  progress_pct  numeric DEFAULT 0,
  synced_to_cloud boolean DEFAULT false,
  metadata      jsonb DEFAULT '{}',
  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE student_progress ENABLE ROW LEVEL SECURITY;
CREATE INDEX idx_progress_student_seq ON student_progress(student_id, sequence_id);
CREATE INDEX idx_progress_class_group ON student_progress(class_group_id);

-- Conductor sessions (teacher-controlled live sessions)
CREATE TABLE conductor_sessions (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  classroom_id    uuid NOT NULL REFERENCES classrooms(id),
  class_group_id  uuid REFERENCES class_groups(id),
  sequence_id     uuid NOT NULL REFERENCES learning_sequences(id),
  teacher_id      uuid NOT NULL REFERENCES users(id),
  current_item_index int DEFAULT 0,
  status          text DEFAULT 'active' CHECK (status IN ('active','paused','completed')),
  started_at      timestamptz DEFAULT now(),
  ended_at        timestamptz,
  metadata        jsonb DEFAULT '{}',
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE conductor_sessions ENABLE ROW LEVEL SECURITY;
CREATE INDEX idx_conductor_classroom ON conductor_sessions(classroom_id);

-- Assign sequences to class groups
CREATE TABLE class_group_sequences (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  class_group_id  uuid NOT NULL REFERENCES class_groups(id),
  sequence_id     uuid NOT NULL REFERENCES learning_sequences(id),
  assigned_at     timestamptz DEFAULT now(),
  due_date        date,
  status          text DEFAULT 'active',
  UNIQUE(class_group_id, sequence_id)
);
ALTER TABLE class_group_sequences ENABLE ROW LEVEL SECURITY;

-- RLS policies (tenant-scoped read for all, insert/update for admins)
DO $$
DECLARE
  tbl text;
BEGIN
  FOR tbl IN SELECT unnest(ARRAY[
    'grades','subjects','terms','class_groups','student_profiles',
    'class_group_students','learning_sequences','sequence_items',
    'quiz_definitions','quiz_questions','quiz_attempts','quiz_responses',
    'student_progress','conductor_sessions','class_group_sequences'
  ]) LOOP
    EXECUTE format('CREATE POLICY "Tenant read %s" ON %I FOR SELECT USING (
      CASE
        WHEN %I ? ''tenant_id'' THEN ((%I->>''tenant_id'')::uuid IN (SELECT tenant_id FROM users WHERE id = auth.uid()))
        ELSE true
      END
    )', tbl, tbl, tbl, tbl);
  END LOOP;
END $$;

-- Simpler: just allow authenticated users full access for now (refine later)
DO $$
DECLARE
  tbl text;
BEGIN
  FOR tbl IN SELECT unnest(ARRAY[
    'grades','subjects','terms','class_groups','student_profiles',
    'class_group_students','learning_sequences','sequence_items',
    'quiz_definitions','quiz_questions','quiz_attempts','quiz_responses',
    'student_progress','conductor_sessions','class_group_sequences'
  ]) LOOP
    EXECUTE format('DROP POLICY IF EXISTS "Tenant read %s" ON %I', tbl, tbl);
    EXECUTE format('CREATE POLICY "auth_select_%s" ON %I FOR SELECT USING (auth.role() = ''authenticated'')', tbl, tbl);
    EXECUTE format('CREATE POLICY "auth_insert_%s" ON %I FOR INSERT WITH CHECK (auth.role() = ''authenticated'')', tbl, tbl);
    EXECUTE format('CREATE POLICY "auth_update_%s" ON %I FOR UPDATE USING (auth.role() = ''authenticated'')', tbl, tbl);
    EXECUTE format('CREATE POLICY "auth_delete_%s" ON %I FOR DELETE USING (auth.role() = ''authenticated'')', tbl, tbl);
  END LOOP;
END $$;

-- updated_at triggers
CREATE TRIGGER trg_grades_updated_at BEFORE UPDATE ON grades FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER trg_subjects_updated_at BEFORE UPDATE ON subjects FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER trg_terms_updated_at BEFORE UPDATE ON terms FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER trg_class_groups_updated_at BEFORE UPDATE ON class_groups FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER trg_student_profiles_updated_at BEFORE UPDATE ON student_profiles FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER trg_learning_sequences_updated_at BEFORE UPDATE ON learning_sequences FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER trg_quiz_definitions_updated_at BEFORE UPDATE ON quiz_definitions FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER trg_student_progress_updated_at BEFORE UPDATE ON student_progress FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER trg_conductor_sessions_updated_at BEFORE UPDATE ON conductor_sessions FOR EACH ROW EXECUTE FUNCTION update_updated_at();
