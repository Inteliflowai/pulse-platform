import Database, { type Database as DatabaseType } from 'better-sqlite3';
import { resolve } from 'path';
import { existsSync, mkdirSync } from 'fs';
import { log } from './logger';

const DATA_DIR = process.env.SYNC_DATA_DIR ?? './data';
if (!existsSync(DATA_DIR)) mkdirSync(DATA_DIR, { recursive: true });

const DB_PATH = resolve(DATA_DIR, 'pulse-node.db');
const db: DatabaseType = new Database(DB_PATH);

db.pragma('journal_mode = WAL');

export function initDb() {
  db.exec(`
    CREATE TABLE IF NOT EXISTS local_sync_jobs (
      job_id       TEXT PRIMARY KEY,
      package_id   TEXT NOT NULL,
      status       TEXT NOT NULL DEFAULT 'pending',
      manifest     TEXT,
      started_at   TEXT,
      completed_at TEXT,
      error        TEXT,
      created_at   TEXT DEFAULT (datetime('now'))
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

    CREATE TABLE IF NOT EXISTS local_packages (
      package_id  TEXT PRIMARY KEY,
      name        TEXT NOT NULL,
      version     TEXT,
      manifest    TEXT,
      status      TEXT NOT NULL DEFAULT 'synced',
      synced_at   TEXT DEFAULT (datetime('now'))
    );
  `);
  log('info', 'Local SQLite database initialized', { path: DB_PATH });
}

export function getLocalSyncJobStatus(jobId: string): string | null {
  const row = db.prepare('SELECT status FROM local_sync_jobs WHERE job_id = ?').get(jobId) as any;
  return row?.status ?? null;
}

export function upsertLocalSyncJob(jobId: string, packageId: string, status: string, manifest: any) {
  db.prepare(
    `INSERT INTO local_sync_jobs (job_id, package_id, status, manifest)
     VALUES (?, ?, ?, ?)
     ON CONFLICT(job_id) DO UPDATE SET status = excluded.status, manifest = excluded.manifest`
  ).run(jobId, packageId, status, JSON.stringify(manifest));
}

export function updateLocalSyncJob(jobId: string, status: string, error?: string) {
  const completedAt = ['completed', 'failed'].includes(status) ? new Date().toISOString() : null;
  db.prepare(
    'UPDATE local_sync_jobs SET status = ?, error = ?, completed_at = ? WHERE job_id = ?'
  ).run(status, error ?? null, completedAt, jobId);
}

export function upsertLocalAsset(assetId: string, filename: string, localPath: string, checksum: string, sizeBytes: number) {
  db.prepare(
    `INSERT INTO local_assets (asset_id, filename, local_path, checksum, size_bytes, status, updated_at)
     VALUES (?, ?, ?, ?, ?, 'ready', datetime('now'))
     ON CONFLICT(asset_id) DO UPDATE SET local_path = excluded.local_path, checksum = excluded.checksum, size_bytes = excluded.size_bytes, status = 'ready', updated_at = datetime('now')`
  ).run(assetId, filename, localPath, checksum, sizeBytes);
}

export function updateLocalAssetJellyfin(assetId: string, jellyfinItemId: string) {
  db.prepare(
    "UPDATE local_assets SET jellyfin_item_id = ?, updated_at = datetime('now') WHERE asset_id = ?"
  ).run(jellyfinItemId, assetId);
}

export function upsertLocalPackage(packageId: string, name: string, version: string, manifest: any) {
  db.prepare(
    `INSERT INTO local_packages (package_id, name, version, manifest, synced_at)
     VALUES (?, ?, ?, ?, datetime('now'))
     ON CONFLICT(package_id) DO UPDATE SET name = excluded.name, version = excluded.version, manifest = excluded.manifest, status = 'synced', synced_at = datetime('now')`
  ).run(packageId, name, version, JSON.stringify(manifest));
}

export function getRandomLocalAssets(pct: number): any[] {
  const total = (db.prepare('SELECT COUNT(*) as c FROM local_assets WHERE status = ?').get('ready') as any).c;
  const limit = Math.max(1, Math.floor(total * pct / 100));
  return db.prepare('SELECT * FROM local_assets WHERE status = ? ORDER BY RANDOM() LIMIT ?').all('ready', limit);
}

export { db as pool };
