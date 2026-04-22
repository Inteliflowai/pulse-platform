import Database from 'better-sqlite3';
import { resolve } from 'path';
import { existsSync, mkdirSync } from 'fs';
import { log } from './logger';

const DATA_DIR = process.env.DATA_DIR ?? './data';
if (!existsSync(DATA_DIR)) mkdirSync(DATA_DIR, { recursive: true });

const DB_PATH = resolve(DATA_DIR, 'pulse-node.db');
const db = new Database(DB_PATH);

db.pragma('journal_mode = WAL');

export function initDb() {
  db.exec(`
    CREATE TABLE IF NOT EXISTS enrolled_devices (
      device_id           TEXT PRIMARY KEY,
      classroom_id        TEXT NOT NULL,
      enrollment_token    TEXT UNIQUE,
      local_session_token TEXT UNIQUE NOT NULL,
      device_name         TEXT,
      device_type         TEXT DEFAULT 'browser',
      schedule_id         TEXT,
      class_group_id      TEXT,
      status              TEXT NOT NULL DEFAULT 'enrolled',
      enrolled_at         TEXT DEFAULT (datetime('now')),
      last_seen_at        TEXT,
      ip_address          TEXT
    );

    CREATE TABLE IF NOT EXISTS classroom_cache (
      classroom_id  TEXT PRIMARY KEY,
      node_id       TEXT,
      name          TEXT NOT NULL,
      room_code     TEXT,
      delivery_mode TEXT DEFAULT 'pulse_local',
      cached_at     TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS local_playback_sessions (
      id                TEXT PRIMARY KEY,
      device_id         TEXT,
      asset_id          TEXT NOT NULL,
      started_at        TEXT DEFAULT (datetime('now')),
      ended_at          TEXT,
      duration_seconds  INTEGER,
      status            TEXT DEFAULT 'active',
      synced_to_cloud   INTEGER DEFAULT 0
    );

    CREATE TABLE IF NOT EXISTS local_packages (
      package_id  TEXT PRIMARY KEY,
      name        TEXT NOT NULL,
      version     TEXT,
      manifest    TEXT,
      status      TEXT NOT NULL DEFAULT 'synced',
      synced_at   TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS local_assets (
      asset_id         TEXT PRIMARY KEY,
      filename         TEXT NOT NULL,
      local_path       TEXT,
      checksum         TEXT,
      size_bytes       INTEGER,
      jellyfin_item_id TEXT,
      status           TEXT NOT NULL DEFAULT 'pending',
      created_at       TEXT DEFAULT (datetime('now')),
      updated_at       TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS student_sessions (
      id              TEXT PRIMARY KEY,
      device_token    TEXT NOT NULL,
      student_id      TEXT NOT NULL,
      student_name    TEXT,
      student_number  TEXT,
      grade_id        TEXT,
      class_group_ids TEXT DEFAULT '[]',
      created_at      TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS conductor_state (
      classroom_id      TEXT PRIMARY KEY,
      sequence_id       TEXT NOT NULL,
      current_item_index INTEGER DEFAULT 0,
      status            TEXT DEFAULT 'active',
      teacher_id        TEXT,
      updated_at        TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS cached_sequences (
      sequence_id   TEXT PRIMARY KEY,
      name          TEXT NOT NULL,
      grade         TEXT,
      subject       TEXT,
      grade_id      TEXT,
      subject_id    TEXT,
      status        TEXT DEFAULT 'published',
      items         TEXT DEFAULT '[]',
      cached_at     TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS local_quiz_attempts (
      id              TEXT PRIMARY KEY,
      quiz_id         TEXT NOT NULL,
      student_id      TEXT NOT NULL,
      student_name    TEXT,
      score           REAL,
      max_score       REAL,
      percentage      REAL,
      passed          INTEGER DEFAULT 0,
      answers         TEXT DEFAULT '{}',
      completed_at    TEXT DEFAULT (datetime('now')),
      synced_to_cloud INTEGER DEFAULT 0
    );

    CREATE TABLE IF NOT EXISTS lesson_completions (
      id                      TEXT PRIMARY KEY,
      node_id                 TEXT NOT NULL,
      classroom_id            TEXT NOT NULL,
      asset_id                TEXT NOT NULL,
      sequence_id             TEXT,
      sequence_item_index     INTEGER,
      student_id              TEXT,
      device_id               TEXT NOT NULL,
      watch_pct               REAL NOT NULL,
      watch_duration_seconds  INTEGER,
      delivery_mode           TEXT NOT NULL,
      completed_at            DATETIME NOT NULL,
      synced_to_core          INTEGER DEFAULT 0,
      sync_attempts           INTEGER DEFAULT 0,
      synced_at               DATETIME,
      created_at              DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE INDEX IF NOT EXISTS idx_lesson_completions_synced
      ON lesson_completions(synced_to_core);

    CREATE TABLE IF NOT EXISTS classroom_schedule_cache (
      id                  TEXT PRIMARY KEY,
      classroom_id        TEXT NOT NULL,
      class_group_id      TEXT NOT NULL,
      sequence_id         TEXT NOT NULL,
      teacher_id          TEXT,
      teacher_name        TEXT,
      class_group_name    TEXT,
      sequence_name       TEXT,
      scheduled_date      TEXT,
      scheduled_time      TEXT NOT NULL,
      duration_minutes    INTEGER NOT NULL,
      recurrence          TEXT NOT NULL DEFAULT 'once',
      recurrence_days     TEXT DEFAULT '[]',
      recurrence_end_date TEXT,
      status              TEXT DEFAULT 'scheduled',
      cached_at           DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE INDEX IF NOT EXISTS idx_schedule_cache_classroom
      ON classroom_schedule_cache(classroom_id, scheduled_time);

    CREATE TABLE IF NOT EXISTS class_group_students_cache (
      id              TEXT PRIMARY KEY,
      class_group_id  TEXT NOT NULL,
      student_id      TEXT NOT NULL,
      student_name    TEXT,
      student_number  TEXT,
      cached_at       DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE INDEX IF NOT EXISTS idx_cgs_cache_group
      ON class_group_students_cache(class_group_id);

    -- Per-service integration credentials pushed from the cloud config
    -- endpoint. Primary key is service so we keep exactly one active row
    -- per integration. api_key is plaintext at rest (same model as other
    -- tokens stored on the node); filesystem perms protect DATA_DIR.
    CREATE TABLE IF NOT EXISTS integration_credentials_cache (
      service     TEXT PRIMARY KEY,
      api_key     TEXT NOT NULL,
      api_url     TEXT,
      cached_at   DATETIME DEFAULT CURRENT_TIMESTAMP
    );
  `);

  // Idempotent column additions for LWW conflict resolution.
  // SQLite does not support IF NOT EXISTS on ADD COLUMN, so we guard with PRAGMA.
  addColumnIfMissing('cached_sequences', 'cloud_updated_at', 'TEXT');
  addColumnIfMissing('conductor_state', 'client_updated_at', 'TEXT');
  // CORE's canonical class identity, cached from the cloud config endpoint
  // so lesson-complete events can pass core_class_id without a round trip.
  addColumnIfMissing('classroom_schedule_cache', 'core_class_id', 'TEXT');

  log('info', 'Local SQLite database initialized', { path: DB_PATH });
}

function addColumnIfMissing(table: string, column: string, type: string) {
  const cols = db.prepare(`PRAGMA table_info(${table})`).all() as { name: string }[];
  if (!cols.some((c) => c.name === column)) {
    db.exec(`ALTER TABLE ${table} ADD COLUMN ${column} ${type}`);
  }
}

export function getEnrolledDevice(token: string) {
  return db.prepare('SELECT * FROM enrolled_devices WHERE local_session_token = ? AND status = ?').get(token, 'enrolled') ?? null;
}

export function getEnrolledDeviceByDeviceId(deviceId: string) {
  return db.prepare('SELECT * FROM enrolled_devices WHERE device_id = ? AND status = ?').get(deviceId, 'enrolled') ?? null;
}

export function upsertEnrolledDevice(deviceId: string, classroomId: string, enrollmentToken: string, localSessionToken: string, ip: string) {
  db.prepare(
    `INSERT INTO enrolled_devices (device_id, classroom_id, enrollment_token, local_session_token, status, ip_address, enrolled_at, last_seen_at)
     VALUES (?, ?, ?, ?, 'enrolled', ?, datetime('now'), datetime('now'))
     ON CONFLICT(device_id) DO UPDATE SET local_session_token = excluded.local_session_token, status = 'enrolled', ip_address = excluded.ip_address, last_seen_at = datetime('now')`
  ).run(deviceId, classroomId, enrollmentToken, localSessionToken, ip);
}

export function getClassroomCache(classroomId: string) {
  return db.prepare('SELECT * FROM classroom_cache WHERE classroom_id = ?').get(classroomId) ?? null;
}

export function upsertClassroomCache(classroomId: string, nodeId: string, name: string, roomCode: string) {
  db.prepare(
    `INSERT INTO classroom_cache (classroom_id, node_id, name, room_code, cached_at)
     VALUES (?, ?, ?, ?, datetime('now'))
     ON CONFLICT(classroom_id) DO UPDATE SET name = excluded.name, room_code = excluded.room_code, cached_at = datetime('now')`
  ).run(classroomId, nodeId, name, roomCode);
}

export function getLocalPackages() {
  return db.prepare("SELECT * FROM local_packages WHERE status = 'synced' ORDER BY name").all();
}

export function getLocalAssets() {
  return db.prepare("SELECT * FROM local_assets WHERE status = 'ready'").all();
}

export function getLocalAssetByJellyfinId(jellyfinItemId: string) {
  return db.prepare('SELECT * FROM local_assets WHERE jellyfin_item_id = ?').get(jellyfinItemId) ?? null;
}

export function getEnrolledDeviceCount(): number {
  return (db.prepare("SELECT COUNT(*) as count FROM enrolled_devices WHERE status = 'enrolled'").get() as any).count;
}

export function getActiveSessionCount(): number {
  return (db.prepare("SELECT COUNT(*) as count FROM local_playback_sessions WHERE status = 'active'").get() as any).count;
}

export function insertPlaybackSession(id: string, deviceId: string, assetId: string) {
  db.prepare('INSERT INTO local_playback_sessions (id, device_id, asset_id) VALUES (?, ?, ?)').run(id, deviceId, assetId);
}

export function touchDevice(token: string, ip: string) {
  db.prepare("UPDATE enrolled_devices SET last_seen_at = datetime('now'), ip_address = ? WHERE local_session_token = ?").run(ip, token);
}

// Student sessions
export function createStudentSession(id: string, deviceToken: string, studentId: string, studentName: string, studentNumber: string, gradeId: string, classGroupIds: string[]) {
  db.prepare(
    `INSERT INTO student_sessions (id, device_token, student_id, student_name, student_number, grade_id, class_group_ids)
     VALUES (?, ?, ?, ?, ?, ?, ?)
     ON CONFLICT(id) DO UPDATE SET student_name = excluded.student_name, class_group_ids = excluded.class_group_ids`
  ).run(id, deviceToken, studentId, studentName, studentNumber, gradeId, JSON.stringify(classGroupIds));
}

export function getStudentSession(deviceToken: string) {
  // Only return sessions less than 24 hours old
  return db.prepare(
    "SELECT * FROM student_sessions WHERE device_token = ? AND created_at > datetime('now', '-24 hours') ORDER BY created_at DESC LIMIT 1"
  ).get(deviceToken) ?? null;
}

export function clearStudentSession(deviceToken: string) {
  db.prepare('DELETE FROM student_sessions WHERE device_token = ?').run(deviceToken);
}

export function cleanupExpiredSessions() {
  db.prepare("DELETE FROM student_sessions WHERE created_at < datetime('now', '-24 hours')").run();
}

// Conductor state — LWW on client_updated_at to resolve multi-device teacher races.
// If the caller omits client_updated_at, we always accept (back-compat).
export function setConductorState(classroomId: string, sequenceId: string, currentItemIndex: number, status: string, teacherId: string, clientUpdatedAt?: string) {
  db.prepare(
    `INSERT INTO conductor_state (classroom_id, sequence_id, current_item_index, status, teacher_id, updated_at, client_updated_at)
     VALUES (?, ?, ?, ?, ?, datetime('now'), ?)
     ON CONFLICT(classroom_id) DO UPDATE SET
       sequence_id = excluded.sequence_id,
       current_item_index = excluded.current_item_index,
       status = excluded.status,
       updated_at = datetime('now'),
       client_updated_at = excluded.client_updated_at
     WHERE excluded.client_updated_at IS NULL
        OR conductor_state.client_updated_at IS NULL
        OR excluded.client_updated_at >= conductor_state.client_updated_at`
  ).run(classroomId, sequenceId, currentItemIndex, status, teacherId, clientUpdatedAt ?? null);
}

export function getConductorState(classroomId: string) {
  return db.prepare('SELECT * FROM conductor_state WHERE classroom_id = ? AND status != ?').get(classroomId, 'completed') ?? null;
}

// Sequence caching — last-write-wins on cloud_updated_at.
// If the incoming row is older than what's cached, drop it silently.
export function cacheSequence(
  seqId: string,
  name: string,
  grade: string,
  subject: string,
  gradeId: string,
  subjectId: string,
  items: any[],
  cloudUpdatedAt?: string,
) {
  db.prepare(
    `INSERT INTO cached_sequences (sequence_id, name, grade, subject, grade_id, subject_id, items, cached_at, cloud_updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, datetime('now'), ?)
     ON CONFLICT(sequence_id) DO UPDATE SET
       name=excluded.name,
       grade=excluded.grade,
       subject=excluded.subject,
       items=excluded.items,
       cached_at=datetime('now'),
       cloud_updated_at=excluded.cloud_updated_at
     WHERE excluded.cloud_updated_at IS NULL
        OR cached_sequences.cloud_updated_at IS NULL
        OR excluded.cloud_updated_at >= cached_sequences.cloud_updated_at`
  ).run(seqId, name, grade, subject, gradeId, subjectId, JSON.stringify(items), cloudUpdatedAt ?? null);
}

export function getCachedSequences(): any[] {
  return db.prepare("SELECT * FROM cached_sequences WHERE status = 'published'").all();
}

export function getCachedSequence(seqId: string): any {
  return db.prepare('SELECT * FROM cached_sequences WHERE sequence_id = ?').get(seqId) ?? null;
}

// Local quiz attempts
export function saveLocalQuizAttempt(id: string, quizId: string, studentId: string, studentName: string, score: number, maxScore: number, percentage: number, passed: boolean, answers: any) {
  db.prepare(
    `INSERT INTO local_quiz_attempts (id, quiz_id, student_id, student_name, score, max_score, percentage, passed, answers)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
  ).run(id, quizId, studentId, studentName, score, maxScore, percentage, passed ? 1 : 0, JSON.stringify(answers));
}

export function getUnsyncedQuizAttempts() {
  return db.prepare('SELECT * FROM local_quiz_attempts WHERE synced_to_cloud = 0').all();
}

export function markQuizAttemptsSynced(ids: string[]) {
  if (ids.length === 0) return;
  const placeholders = ids.map(() => '?').join(',');
  db.prepare(`UPDATE local_quiz_attempts SET synced_to_cloud = 1 WHERE id IN (${placeholders})`).run(...ids);
}

// Lesson completions
export function insertLessonCompletion(
  id: string, nodeId: string, classroomId: string, assetId: string,
  sequenceId: string | null, sequenceItemIndex: number | null,
  studentId: string | null, deviceId: string, watchPct: number,
  watchDurationSeconds: number, deliveryMode: string, completedAt: string
) {
  db.prepare(
    `INSERT INTO lesson_completions
     (id, node_id, classroom_id, asset_id, sequence_id, sequence_item_index,
      student_id, device_id, watch_pct, watch_duration_seconds, delivery_mode, completed_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
  ).run(id, nodeId, classroomId, assetId, sequenceId, sequenceItemIndex,
    studentId, deviceId, watchPct, watchDurationSeconds, deliveryMode, completedAt);
}

export function markLessonCompletionSynced(id: string) {
  db.prepare(
    "UPDATE lesson_completions SET synced_to_core = 1, synced_at = datetime('now') WHERE id = ?"
  ).run(id);
}

export function markLessonCompletionFailed(id: string) {
  db.prepare(
    'UPDATE lesson_completions SET synced_to_core = -1 WHERE id = ?'
  ).run(id);
}

export function incrementLessonCompletionAttempts(id: string) {
  db.prepare(
    'UPDATE lesson_completions SET sync_attempts = sync_attempts + 1 WHERE id = ?'
  ).run(id);
}

export function getUnsyncedLessonCompletions(): any[] {
  return db.prepare(
    'SELECT * FROM lesson_completions WHERE synced_to_core = 0 AND student_id IS NOT NULL AND sync_attempts < 10'
  ).all();
}

// Schedule cache
export function upsertScheduleCache(schedule: {
  id: string; classroom_id: string; class_group_id: string; sequence_id: string;
  teacher_id: string | null; teacher_name: string | null; class_group_name: string | null;
  sequence_name: string | null; scheduled_date: string | null; scheduled_time: string;
  duration_minutes: number; recurrence: string; recurrence_days: string;
  recurrence_end_date: string | null; status: string;
  core_class_id?: string | null;
}) {
  db.prepare(
    `INSERT INTO classroom_schedule_cache
     (id, classroom_id, class_group_id, sequence_id, teacher_id, teacher_name,
      class_group_name, sequence_name, scheduled_date, scheduled_time, duration_minutes,
      recurrence, recurrence_days, recurrence_end_date, status, core_class_id, cached_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'))
     ON CONFLICT(id) DO UPDATE SET
      classroom_id=excluded.classroom_id, class_group_id=excluded.class_group_id,
      sequence_id=excluded.sequence_id, teacher_id=excluded.teacher_id,
      teacher_name=excluded.teacher_name, class_group_name=excluded.class_group_name,
      sequence_name=excluded.sequence_name, scheduled_date=excluded.scheduled_date,
      scheduled_time=excluded.scheduled_time, duration_minutes=excluded.duration_minutes,
      recurrence=excluded.recurrence, recurrence_days=excluded.recurrence_days,
      recurrence_end_date=excluded.recurrence_end_date, status=excluded.status,
      core_class_id=excluded.core_class_id,
      cached_at=datetime('now')`
  ).run(
    schedule.id, schedule.classroom_id, schedule.class_group_id, schedule.sequence_id,
    schedule.teacher_id, schedule.teacher_name, schedule.class_group_name,
    schedule.sequence_name, schedule.scheduled_date, schedule.scheduled_time,
    schedule.duration_minutes, schedule.recurrence, schedule.recurrence_days,
    schedule.recurrence_end_date, schedule.status, schedule.core_class_id ?? null
  );
}

export function deleteScheduleCacheNotIn(ids: string[]) {
  if (ids.length === 0) {
    db.prepare('DELETE FROM classroom_schedule_cache').run();
    return;
  }
  const placeholders = ids.map(() => '?').join(',');
  db.prepare(`DELETE FROM classroom_schedule_cache WHERE id NOT IN (${placeholders})`).run(...ids);
}

export function getSchedulesForClassroom(classroomId: string): any[] {
  return db.prepare(
    "SELECT * FROM classroom_schedule_cache WHERE classroom_id = ? AND status != 'cancelled' ORDER BY scheduled_time"
  ).all(classroomId);
}

// Integration credentials (CORE / SPARK / LIFT Bearer keys pushed from cloud).
export function upsertIntegrationCredential(service: string, apiKey: string, apiUrl: string | null) {
  db.prepare(
    `INSERT INTO integration_credentials_cache (service, api_key, api_url, cached_at)
     VALUES (?, ?, ?, datetime('now'))
     ON CONFLICT(service) DO UPDATE SET
       api_key=excluded.api_key,
       api_url=excluded.api_url,
       cached_at=datetime('now')`
  ).run(service, apiKey, apiUrl);
}

export function getIntegrationCredential(service: string): { api_key: string; api_url: string | null } | null {
  const row = db.prepare('SELECT api_key, api_url FROM integration_credentials_cache WHERE service = ?').get(service) as
    | { api_key: string; api_url: string | null }
    | undefined;
  return row ?? null;
}

export function deleteIntegrationCredentialsNotIn(services: string[]) {
  if (services.length === 0) {
    db.prepare('DELETE FROM integration_credentials_cache').run();
    return;
  }
  const placeholders = services.map(() => '?').join(',');
  db.prepare(`DELETE FROM integration_credentials_cache WHERE service NOT IN (${placeholders})`).run(...services);
}

export function getAllSchedules(): any[] {
  return db.prepare(
    "SELECT * FROM classroom_schedule_cache WHERE status != 'cancelled' ORDER BY scheduled_time"
  ).all();
}

export function updateEnrolledDeviceSchedule(deviceId: string, scheduleId: string | null, classGroupId: string | null) {
  db.prepare(
    'UPDATE enrolled_devices SET schedule_id = ?, class_group_id = ? WHERE device_id = ?'
  ).run(scheduleId, classGroupId, deviceId);
}

// Class group students cache
export function upsertClassGroupStudent(id: string, classGroupId: string, studentId: string, studentName: string | null, studentNumber: string | null) {
  db.prepare(
    `INSERT INTO class_group_students_cache (id, class_group_id, student_id, student_name, student_number, cached_at)
     VALUES (?, ?, ?, ?, ?, datetime('now'))
     ON CONFLICT(id) DO UPDATE SET student_name=excluded.student_name, student_number=excluded.student_number, cached_at=datetime('now')`
  ).run(id, classGroupId, studentId, studentName, studentNumber);
}

export function getClassGroupStudents(classGroupId: string): any[] {
  return db.prepare('SELECT * FROM class_group_students_cache WHERE class_group_id = ?').all(classGroupId);
}

export function isStudentInClassGroup(studentId: string, classGroupId: string): boolean {
  const row = db.prepare('SELECT 1 FROM class_group_students_cache WHERE student_id = ? AND class_group_id = ?').get(studentId, classGroupId);
  return !!row;
}
