import { log } from './logger';
import { createHash } from 'crypto';
import { createWriteStream, createReadStream, existsSync, mkdirSync, copyFileSync, readFileSync } from 'fs';
import { resolve } from 'path';
import { spawn } from 'child_process';
import { pipeline } from 'stream/promises';

const CLOUD_API_URL = process.env.CLOUD_API_URL ?? '';
const NODE_ID = process.env.NODE_ID ?? '';
const AUTO_UPDATE = process.env.AUTO_UPDATE === 'true';
// The actual docker-compose invocation is a footgun when running outside Docker
// (dev, tests). We only apply if the operator opts in explicitly.
const UPDATE_APPLY_ENABLED = process.env.UPDATE_APPLY_ENABLED === 'true';
const UPDATE_DIR = process.env.UPDATE_DIR ?? './data/updates';
const COMPOSE_FILE = process.env.COMPOSE_FILE ?? '/opt/pulse/docker-compose.yml';
const HEALTH_CHECK_URL = process.env.HEALTH_CHECK_URL ?? `http://localhost:${process.env.PORT ?? 3100}/health`;
const UPDATE_CHECK_INTERVAL = 10 * 60 * 1000; // 10 minutes

// Maintenance window config (synced from cloud via config endpoint)
let maintenanceWindow: {
  enabled: boolean;
  start_hour: number;
  end_hour: number;
  days: number[];
} | null = null;

export function setMaintenanceWindow(config: any) {
  if (config && typeof config === 'object' && config.enabled !== undefined) {
    maintenanceWindow = {
      enabled: !!config.enabled,
      start_hour: config.start_hour ?? 2,
      end_hour: config.end_hour ?? 4,
      days: Array.isArray(config.days) ? config.days : [0, 1, 2, 3, 4, 5, 6],
    };
    log('info', 'Maintenance window updated', maintenanceWindow);
  }
}

function isInMaintenanceWindow(): boolean {
  if (!maintenanceWindow || !maintenanceWindow.enabled) return true; // No window = always allowed
  const now = new Date();
  const hour = now.getHours();
  const day = now.getDay();

  if (!maintenanceWindow.days.includes(day)) return false;

  if (maintenanceWindow.start_hour < maintenanceWindow.end_hour) {
    return hour >= maintenanceWindow.start_hour && hour < maintenanceWindow.end_hour;
  }
  // Handle overnight window (e.g. 23:00 - 04:00)
  return hour >= maintenanceWindow.start_hour || hour < maintenanceWindow.end_hour;
}

export function startUpdateManager() {
  log('info', 'Update manager started', { auto_update: AUTO_UPDATE });
  checkForUpdates();
  setInterval(checkForUpdates, UPDATE_CHECK_INTERVAL);
}

async function checkForUpdates() {
  if (!CLOUD_API_URL || !NODE_ID) return;

  try {
    const res = await fetch(`${CLOUD_API_URL}/api/updates/available?node_id=${NODE_ID}`);
    if (!res.ok) return;

    const data: any = await res.json();
    if (!data.update_available) return;

    log('info', 'Update available', {
      current: data.current_version,
      latest: data.latest_version,
      assignment_id: data.assignment_id,
    });

    if (AUTO_UPDATE && data.download_url) {
      // Check maintenance window before applying
      if (!isInMaintenanceWindow()) {
        log('info', 'update_deferred_outside_maintenance_window', {
          version: data.latest_version,
          window: maintenanceWindow,
        });
        return;
      }
      await performUpdate(data);
    }
  } catch (err: any) {
    log('warning', 'Update check failed', { error: err.message });
  }
}

async function performUpdate(updateInfo: any) {
  const { assignment_id, download_url, checksum, latest_version } = updateInfo;

  log('info', 'Starting auto-update', { version: latest_version });

  try {
    if (!existsSync(UPDATE_DIR)) mkdirSync(UPDATE_DIR, { recursive: true });

    // 1. Download to staging path.
    if (assignment_id) await reportStatus(assignment_id, 'downloading');
    const bundlePath = resolve(UPDATE_DIR, `${latest_version}.tar.gz`);
    await downloadBundle(download_url, bundlePath);

    // 2. Verify SHA-256 checksum before we touch anything running.
    if (checksum) {
      const actual = await sha256OfFile(bundlePath);
      if (actual.toLowerCase() !== String(checksum).toLowerCase()) {
        throw new Error(`checksum mismatch: expected=${checksum} actual=${actual}`);
      }
    }

    if (!UPDATE_APPLY_ENABLED) {
      // Bundle is verified and staged; operator opts in to apply via env var.
      log('info', 'update_staged_apply_disabled', {
        version: latest_version,
        bundle: bundlePath,
        hint: 'Set UPDATE_APPLY_ENABLED=true to apply',
      });
      if (assignment_id) await reportStatus(assignment_id, 'staged');
      return;
    }

    // 3. Snapshot current compose file for rollback.
    const rollbackPath = resolve(UPDATE_DIR, `rollback-${Date.now()}.yml`);
    if (existsSync(COMPOSE_FILE)) {
      copyFileSync(COMPOSE_FILE, rollbackPath);
      log('info', 'compose_snapshot_created', { rollback: rollbackPath });
    }

    // 4. Apply: pull new images + restart.
    if (assignment_id) await reportStatus(assignment_id, 'applying');
    await runDockerCompose(['-f', COMPOSE_FILE, 'pull']);
    await runDockerCompose(['-f', COMPOSE_FILE, 'up', '-d']);

    // 5. Health check with backoff — give services time to become ready.
    const healthy = await waitForHealth(HEALTH_CHECK_URL, 60_000);
    if (!healthy) {
      throw new Error('Post-update health check failed within 60s');
    }

    log('info', 'auto_update_completed', { version: latest_version });
    if (assignment_id) await reportStatus(assignment_id, 'completed');
  } catch (err: any) {
    log('error', 'auto_update_failed', { error: err.message });
    if (UPDATE_APPLY_ENABLED) {
      // Best-effort rollback if we already applied.
      try { await rollbackLatest(); } catch (rbErr: any) {
        log('error', 'rollback_failed', { error: rbErr.message });
      }
    }
    if (assignment_id) await reportStatus(assignment_id, 'failed', err.message);
  }
}

async function downloadBundle(url: string, destPath: string): Promise<void> {
  const res = await fetch(url);
  if (!res.ok || !res.body) throw new Error(`Download failed: HTTP ${res.status}`);
  await pipeline(res.body as any, createWriteStream(destPath));
}

function sha256OfFile(path: string): Promise<string> {
  return new Promise((res, rej) => {
    const hash = createHash('sha256');
    const stream = createReadStream(path);
    stream.on('data', (d) => hash.update(d));
    stream.on('end', () => res(hash.digest('hex')));
    stream.on('error', rej);
  });
}

function runDockerCompose(args: string[]): Promise<void> {
  return new Promise((res, rej) => {
    const proc = spawn('docker', ['compose', ...args], { stdio: 'inherit' });
    proc.on('exit', (code) => code === 0 ? res() : rej(new Error(`docker compose ${args.join(' ')} exited ${code}`)));
    proc.on('error', rej);
  });
}

async function waitForHealth(url: string, timeoutMs: number): Promise<boolean> {
  const deadline = Date.now() + timeoutMs;
  let backoff = 1000;
  while (Date.now() < deadline) {
    try {
      const r = await fetch(url, { signal: AbortSignal.timeout(3000) });
      if (r.ok) return true;
    } catch {}
    await new Promise((r) => setTimeout(r, backoff));
    backoff = Math.min(backoff * 2, 8000);
  }
  return false;
}

async function rollbackLatest(): Promise<void> {
  // Find the most recent rollback snapshot in UPDATE_DIR.
  const { readdirSync, statSync } = await import('fs');
  if (!existsSync(UPDATE_DIR)) return;
  const snapshots = readdirSync(UPDATE_DIR)
    .filter((f) => f.startsWith('rollback-') && f.endsWith('.yml'))
    .map((f) => ({ f, mtime: statSync(resolve(UPDATE_DIR, f)).mtimeMs }))
    .sort((a, b) => b.mtime - a.mtime);
  if (snapshots.length === 0) { log('warning', 'rollback_no_snapshot_found'); return; }
  const snapshotPath = resolve(UPDATE_DIR, snapshots[0].f);
  copyFileSync(snapshotPath, COMPOSE_FILE);
  await runDockerCompose(['-f', COMPOSE_FILE, 'up', '-d']);
  log('info', 'rollback_applied', { snapshot: snapshotPath });
}

async function reportStatus(assignmentId: string, status: string, error?: string) {
  try {
    await fetch(`${CLOUD_API_URL}/api/updates/${assignmentId}/status`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status, error }),
    });
  } catch {
    log('warning', 'Failed to report update status');
  }
}
