/**
 * SQLite backup/restore for node data.
 * Creates timestamped backups and supports restore from backup files.
 */

import { existsSync, mkdirSync, copyFileSync, readdirSync, statSync } from 'fs';
import { resolve, basename } from 'path';
import { log } from './logger';

const DATA_DIR = process.env.DATA_DIR ?? './data';
const BACKUP_DIR = resolve(DATA_DIR, 'backups');
const DB_PATH = resolve(DATA_DIR, 'pulse-node.db');
const MAX_BACKUPS = 10;

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

export function listBackups(): { filename: string; size: number; created: Date }[] {
  try {
    if (!existsSync(BACKUP_DIR)) return [];
    return readdirSync(BACKUP_DIR)
      .filter((f) => f.endsWith('.db'))
      .map((f) => {
        const stat = statSync(resolve(BACKUP_DIR, f));
        return { filename: f, size: stat.size, created: stat.mtime };
      })
      .sort((a, b) => b.created.getTime() - a.created.getTime());
  } catch {
    return [];
  }
}

function pruneBackups() {
  const backups = listBackups();
  if (backups.length <= MAX_BACKUPS) return;

  const toDelete = backups.slice(MAX_BACKUPS);
  for (const backup of toDelete) {
    try {
      const { unlinkSync } = require('fs');
      unlinkSync(resolve(BACKUP_DIR, backup.filename));
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
