/**
 * SQLite backup/restore for node data.
 * Creates timestamped backups with integrity verification.
 */

import Database from 'better-sqlite3';
import { existsSync, mkdirSync, copyFileSync, readdirSync, statSync, unlinkSync } from 'fs';
import { resolve } from 'path';
import { log } from './logger';

const DATA_DIR = process.env.DATA_DIR ?? './data';
const BACKUP_DIR = resolve(DATA_DIR, 'backups');
const DB_PATH = resolve(DATA_DIR, 'pulse-node.db');
const MAX_BACKUPS = 10;

interface BackupInfo {
  filename: string;
  size: number;
  created: Date;
  verified?: boolean;
  verification_error?: string | null;
}

// In-memory verification results (persists for process lifetime)
const verificationResults = new Map<string, { verified: boolean; error: string | null; checked_at: string }>();

export function createBackup(): string | null {
  try {
    if (!existsSync(DB_PATH)) {
      log('warning', 'No database to back up');
      return null;
    }

    if (!existsSync(BACKUP_DIR)) mkdirSync(BACKUP_DIR, { recursive: true });

    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const backupPath = resolve(BACKUP_DIR, `pulse-node-${timestamp}.db`);

    copyFileSync(DB_PATH, backupPath);
    log('info', 'Backup created', { path: backupPath });

    // Verify the backup immediately
    const verification = verifyBackupFile(backupPath);
    const filename = `pulse-node-${timestamp}.db`;
    verificationResults.set(filename, {
      verified: verification.ok,
      error: verification.error,
      checked_at: new Date().toISOString(),
    });

    if (!verification.ok) {
      log('warning', 'Backup integrity check failed', { path: backupPath, error: verification.error });
    }

    // Prune old backups
    pruneBackups();

    return backupPath;
  } catch (err: any) {
    log('error', 'Backup failed', { error: err.message });
    return null;
  }
}

export function restoreBackup(backupFilename: string): boolean {
  try {
    const backupPath = resolve(BACKUP_DIR, backupFilename);
    if (!existsSync(backupPath)) {
      log('error', 'Backup file not found', { path: backupPath });
      return false;
    }

    // Create a safety backup of current DB first
    if (existsSync(DB_PATH)) {
      const safetyPath = resolve(BACKUP_DIR, `pulse-node-pre-restore-${Date.now()}.db`);
      copyFileSync(DB_PATH, safetyPath);
    }

    copyFileSync(backupPath, DB_PATH);
    log('info', 'Database restored from backup', { source: backupFilename });
    return true;
  } catch (err: any) {
    log('error', 'Restore failed', { error: err.message });
    return false;
  }
}

export function listBackups(): BackupInfo[] {
  try {
    if (!existsSync(BACKUP_DIR)) return [];
    return readdirSync(BACKUP_DIR)
      .filter((f) => f.endsWith('.db'))
      .map((f) => {
        const stat = statSync(resolve(BACKUP_DIR, f));
        const ver = verificationResults.get(f);
        return {
          filename: f,
          size: stat.size,
          created: stat.mtime,
          verified: ver?.verified,
          verification_error: ver?.error ?? null,
        };
      })
      .sort((a, b) => b.created.getTime() - a.created.getTime());
  } catch {
    return [];
  }
}

function verifyBackupFile(filePath: string): { ok: boolean; error: string | null } {
  try {
    const testDb = new Database(filePath, { readonly: true });
    const result = testDb.pragma('integrity_check') as any[];
    testDb.close();

    const firstResult = result?.[0];
    const integrityOk = firstResult?.integrity_check === 'ok' || firstResult === 'ok';
    return { ok: integrityOk, error: integrityOk ? null : JSON.stringify(result) };
  } catch (err: any) {
    return { ok: false, error: err.message };
  }
}

export function verifyLatestBackup(): { ok: boolean; error: string | null; checked_at: string } {
  const backups = listBackups();
  if (backups.length === 0) {
    return { ok: false, error: 'No backups found', checked_at: new Date().toISOString() };
  }

  const latest = backups[0];
  const backupPath = resolve(BACKUP_DIR, latest.filename);
  const result = verifyBackupFile(backupPath);

  verificationResults.set(latest.filename, {
    verified: result.ok,
    error: result.error,
    checked_at: new Date().toISOString(),
  });

  return { ok: result.ok, error: result.error, checked_at: new Date().toISOString() };
}

export function getBackupStatus() {
  const backups = listBackups();
  const latest = backups.length > 0 ? backups[0] : null;
  const latestVer = latest ? verificationResults.get(latest.filename) : null;

  return {
    last_backup_at: latest?.created?.toISOString() ?? null,
    backup_count: backups.length,
    latest_backup: latest ? {
      filename: latest.filename,
      size_bytes: latest.size,
      created_at: latest.created.toISOString(),
      verified: latestVer?.verified ?? false,
      verification_error: latestVer?.error ?? null,
    } : null,
    backup_files: backups.map(b => ({
      filename: b.filename,
      size_bytes: b.size,
      created_at: b.created.toISOString(),
    })),
  };
}

function pruneBackups() {
  const backups = listBackups();
  if (backups.length <= MAX_BACKUPS) return;

  const toDelete = backups.slice(MAX_BACKUPS);
  for (const backup of toDelete) {
    try {
      unlinkSync(resolve(BACKUP_DIR, backup.filename));
      verificationResults.delete(backup.filename);
      log('info', 'Old backup pruned', { filename: backup.filename });
    } catch {}
  }
}

// Auto-backup every 6 hours
export function startAutoBackup() {
  const SIX_HOURS = 6 * 60 * 60 * 1000;
  createBackup(); // Initial backup
  setInterval(createBackup, SIX_HOURS);
  log('info', 'Auto-backup scheduled (every 6 hours)');
}
