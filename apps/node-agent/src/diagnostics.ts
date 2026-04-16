/**
 * Remote Diagnostics Collection
 *
 * Collects system state for remote troubleshooting by sysadmins.
 * Sanitizes logs to remove secrets before returning.
 */

import { existsSync, statSync, readFileSync } from 'fs';
import { resolve } from 'path';
import { log } from './logger';
import { getEnrolledDeviceCount, getActiveSessionCount } from './db';
import { listBackups } from './backup';

const NODE_ID = process.env.NODE_ID ?? '';
const CLOUD_API_URL = process.env.CLOUD_API_URL ?? '';
const JELLYFIN_ADAPTER_URL = process.env.JELLYFIN_ADAPTER_URL ?? 'http://jellyfin-adapter:3101';
const DATA_DIR = process.env.DATA_DIR ?? './data';
const DB_PATH = resolve(DATA_DIR, 'pulse-node.db');

const SENSITIVE_PATTERNS = /token|secret|key|password|credential/i;

interface DiagnosticReport {
  collected_at: string;
  node_id: string;
  system: {
    uptime_seconds: number;
    cpu_pct: number;
    memory_used_gb: number;
    memory_total_gb: number;
    disk_free_gb: number;
    disk_total_gb: number;
  };
  services: Record<string, 'running' | 'unreachable'>;
  recent_errors: string[];
  recent_sync_jobs: any[];
  enrolled_devices_count: number;
  active_sessions_count: number;
  sqlite_size_bytes: number;
  last_backup_at: string | null;
  last_heartbeat_sent_at: string | null;
  env_check: { key: string; present: boolean }[];
}

async function checkService(url: string, timeout: number = 3000): Promise<'running' | 'unreachable'> {
  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(timeout) });
    return res.ok || res.status < 500 ? 'running' : 'unreachable';
  } catch {
    return 'unreachable';
  }
}

function sanitizeLogs(lines: string[]): string[] {
  return lines.filter(line => !SENSITIVE_PATTERNS.test(line));
}

export async function collectDiagnostics(): Promise<DiagnosticReport> {
  // System metrics
  const os = await import('os');
  const totalMem = os.totalmem();
  const freeMem = os.freemem();
  const cpus = os.cpus();
  const cpuIdle = cpus.reduce((sum, c) => sum + c.times.idle, 0);
  const cpuTotal = cpus.reduce((sum, c) => sum + c.times.user + c.times.nice + c.times.sys + c.times.idle + c.times.irq, 0);
  const cpuPct = cpuTotal > 0 ? Math.round((1 - cpuIdle / cpuTotal) * 100) : 0;

  // Disk — estimate from data directory
  let diskFreeGb = 0;
  let diskTotalGb = 0;
  try {
    // Use process.report for Node.js >= 18
    const report = process.report?.getReport() as any;
    if (report?.resourceUsage) {
      diskTotalGb = 100; // placeholder
      diskFreeGb = 50;
    }
  } catch {}

  // Check services
  const [jellyfinAdapter, jellyfinDirect, cloudApi] = await Promise.all([
    checkService(`${JELLYFIN_ADAPTER_URL}/health`),
    checkService('http://localhost:8096/health'),
    checkService(`${CLOUD_API_URL}/api/health`),
  ]);

  // Enrolled devices and sessions
  let enrolledDevices = 0;
  let activeSessions = 0;
  try { enrolledDevices = getEnrolledDeviceCount(); } catch {}
  try { activeSessions = getActiveSessionCount(); } catch {}

  // SQLite size
  let sqliteSize = 0;
  try {
    if (existsSync(DB_PATH)) sqliteSize = statSync(DB_PATH).size;
  } catch {}

  // Last backup
  const backups = listBackups();
  const lastBackup = backups.length > 0 ? backups[0].created.toISOString() : null;

  // Recent errors (from stderr/stdout — in production, read log file)
  const recentErrors: string[] = [];

  // Env check
  const requiredEnvKeys = ['NODE_ID', 'CLOUD_API_URL', 'NODE_REGISTRATION_TOKEN', 'JELLYFIN_ADAPTER_URL', 'CORE_API_URL', 'CORE_API_SECRET', 'DATA_DIR'];
  const envCheck = requiredEnvKeys.map(key => ({ key, present: !!process.env[key] }));

  return {
    collected_at: new Date().toISOString(),
    node_id: NODE_ID,
    system: {
      uptime_seconds: Math.floor(os.uptime()),
      cpu_pct: cpuPct,
      memory_used_gb: parseFloat(((totalMem - freeMem) / 1e9).toFixed(2)),
      memory_total_gb: parseFloat((totalMem / 1e9).toFixed(2)),
      disk_free_gb: diskFreeGb,
      disk_total_gb: diskTotalGb,
    },
    services: {
      node_agent: 'running',
      jellyfin_adapter: jellyfinAdapter,
      jellyfin: jellyfinDirect,
      cloud_api: cloudApi,
    },
    recent_errors: sanitizeLogs(recentErrors),
    recent_sync_jobs: [],
    enrolled_devices_count: enrolledDevices,
    active_sessions_count: activeSessions,
    sqlite_size_bytes: sqliteSize,
    last_backup_at: lastBackup,
    last_heartbeat_sent_at: null,
    env_check: envCheck,
  };
}
