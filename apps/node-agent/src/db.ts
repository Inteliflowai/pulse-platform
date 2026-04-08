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
