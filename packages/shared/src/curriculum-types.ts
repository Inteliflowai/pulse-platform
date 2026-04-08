// ============================================================
// Phase 3: Curriculum, Learning Sequences, Quiz Engine Types
// ============================================================

export interface Grade {
  id: string;
  tenant_id: string;
  name: string;
  sort_order: number;
  metadata: Record<string, unknown>;
  created_at: string;
  updated_at: string;
}

export interface Subject {
  id: string;
  tenant_id: string;
  name: string;
  code: string | null;
  color: string;
  metadata: Record<string, unknown>;
  created_at: string;
  updated_at: string;
}

export interface Term {
  id: string;
  tenant_id: string;
  name: string;
  start_date: string | null;
  end_date: string | null;
  is_active: boolean;
  metadata: Record<string, unknown>;
  created_at: string;
  updated_at: string;
}

export interface ClassGroup {
  id: string;
  tenant_id: string;
  site_id: string | null;
  classroom_id: string | null;
  grade_id: string;
  subject_id: string;
  term_id: string | null;
  name: string;
  teacher_id: string | null;
  status: string;
  metadata: Record<string, unknown>;
  created_at: string;
  updated_at: string;
}

export interface StudentProfile {
  id: string;
  user_id: string;
  tenant_id: string;
  grade_id: string | null;
  student_number: string | null;
  date_of_birth: string | null;
  metadata: Record<string, unknown>;
  created_at: string;
  updated_at: string;
}

export type SequenceItemType = 'video' | 'quiz' | 'document' | 'interactive' | 'break';

export interface LearningSequence {
  id: string;
  tenant_id: string;
  package_id: string | null;
  grade_id: string | null;
  subject_id: string | null;
  term_id: string | null;
  name: string;
  description: string | null;
  created_by: string | null;
  status: 'draft' | 'published' | 'archived';
  metadata: Record<string, unknown>;
  created_at: string;
  updated_at: string;
}

export interface SequenceItem {
  id: string;
  sequence_id: string;
  sort_order: number;
  item_type: SequenceItemType;
  title: string;
  asset_id: string | null;
  quiz_id: string | null;
  duration_minutes: number | null;
  auto_advance: boolean;
  require_completion: boolean;
  metadata: Record<string, unknown>;
  created_at: string;
}

export type QuestionType = 'multiple_choice' | 'true_false' | 'short_answer' | 'matching' | 'ordering';

export interface QuizDefinition {
  id: string;
  tenant_id: string;
  sequence_id: string | null;
  title: string;
  description: string | null;
  time_limit_minutes: number | null;
  pass_percentage: number;
  max_attempts: number;
  shuffle_questions: boolean;
  show_results: boolean;
  created_by: string | null;
  source: 'pulse' | 'core' | 'spark';
  external_id: string | null;
  status: 'draft' | 'published' | 'archived';
  metadata: Record<string, unknown>;
  created_at: string;
  updated_at: string;
}

export interface QuizQuestion {
  id: string;
  quiz_id: string;
  sort_order: number;
  question_type: QuestionType;
  question_text: string;
  options: { id: string; text: string; is_correct: boolean }[];
  correct_answer: string | null;
  points: number;
  explanation: string | null;
  media_asset_id: string | null;
  metadata: Record<string, unknown>;
  created_at: string;
}

export interface QuizAttempt {
  id: string;
  quiz_id: string;
  student_id: string;
  node_id: string | null;
  device_id: string | null;
  attempt_number: number;
  started_at: string;
  completed_at: string | null;
  score: number | null;
  max_score: number | null;
  percentage: number | null;
  passed: boolean | null;
  status: 'in_progress' | 'completed' | 'abandoned' | 'timed_out';
  synced_to_cloud: boolean;
  metadata: Record<string, unknown>;
  created_at: string;
}

export interface QuizResponse {
  id: string;
  attempt_id: string;
  question_id: string;
  answer: string | null;
  answer_data: Record<string, unknown> | null;
  is_correct: boolean | null;
  points_earned: number;
  time_spent_seconds: number | null;
  created_at: string;
}

export interface StudentProgress {
  id: string;
  student_id: string;
  sequence_id: string;
  sequence_item_id: string | null;
  class_group_id: string | null;
  node_id: string | null;
  status: 'not_started' | 'in_progress' | 'completed' | 'skipped';
  started_at: string | null;
  completed_at: string | null;
  watch_time_seconds: number;
  progress_pct: number;
  synced_to_cloud: boolean;
  metadata: Record<string, unknown>;
  created_at: string;
  updated_at: string;
}

export interface ConductorSession {
  id: string;
  classroom_id: string;
  class_group_id: string | null;
  sequence_id: string;
  teacher_id: string;
  current_item_index: number;
  status: 'active' | 'paused' | 'completed';
  started_at: string;
  ended_at: string | null;
  metadata: Record<string, unknown>;
  created_at: string;
  updated_at: string;
}

// Payload for syncing quiz results from node to cloud
export interface QuizResultsSyncPayload {
  node_id: string;
  attempts: {
    attempt_id: string;
    quiz_id: string;
    student_id: string;
    score: number;
    max_score: number;
    percentage: number;
    passed: boolean;
    completed_at: string;
    responses: {
      question_id: string;
      answer: string;
      is_correct: boolean;
      points_earned: number;
    }[];
  }[];
}
