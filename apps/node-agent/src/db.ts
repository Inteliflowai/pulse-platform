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
  `);
  log('info', 'Local SQLite database initialized', { path: DB_PATH });
}

export function getEnrolledDevice(token: string) {
  return db.prepare('SELECT * FROM enrolled_devices WHERE local_session_token = ? AND status = ?').get(token, 'enrolled') ?? null;
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
  return db.prepare('SELECT * FROM student_sessions WHERE device_token = ? ORDER BY created_at DESC LIMIT 1').get(deviceToken) ?? null;
}

export function clearStudentSession(deviceToken: string) {
  db.prepare('DELETE FROM student_sessions WHERE device_token = ?').run(deviceToken);
}

// Conductor state
export function setConductorState(classroomId: string, sequenceId: string, currentItemIndex: number, status: string, teacherId: string) {
  db.prepare(
    `INSERT INTO conductor_state (classroom_id, sequence_id, current_item_index, status, teacher_id, updated_at)
     VALUES (?, ?, ?, ?, ?, datetime('now'))
     ON CONFLICT(classroom_id) DO UPDATE SET sequence_id = excluded.sequence_id, current_item_index = excluded.current_item_index, status = excluded.status, updated_at = datetime('now')`
  ).run(classroomId, sequenceId, currentItemIndex, status, teacherId);
}

export function getConductorState(classroomId: string) {
  return db.prepare('SELECT * FROM conductor_state WHERE classroom_id = ? AND status != ?').get(classroomId, 'completed') ?? null;
}

// Sequence caching
export function cacheSequence(seqId: string, name: string, grade: string, subject: string, gradeId: string, subjectId: string, items: any[]) {
  db.prepare(
    `INSERT INTO cached_sequences (sequence_id, name, grade, subject, grade_id, subject_id, items, cached_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, datetime('now'))
     ON CONFLICT(sequence_id) DO UPDATE SET name=excluded.name, grade=excluded.grade, subject=excluded.subject, items=excluded.items, cached_at=datetime('now')`
  ).run(seqId, name, grade, subject, gradeId, subjectId, JSON.stringify(items));
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
