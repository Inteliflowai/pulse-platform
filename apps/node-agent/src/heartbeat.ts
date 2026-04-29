import os from 'os';
import { execSync } from 'child_process';
import type { HeartbeatPayload } from '@pulse/shared';
import { log } from './logger';
import { getEnrolledDeviceCount, getActiveSessionCount } from './db';

const NODE_ID = process.env.NODE_ID ?? '';
const CLOUD_API_URL = process.env.CLOUD_API_URL ?? '';
const NODE_TOKEN = process.env.NODE_REGISTRATION_TOKEN ?? '';
const JELLYFIN_ADAPTER_URL = process.env.JELLYFIN_ADAPTER_URL ?? 'http://jellyfin-adapter:3101';

let startTime = Date.now();

async function getCpuUsage(): Promise<number> {
  const cpus1 = os.cpus();
  await new Promise((r) => setTimeout(r, 1000));
  const cpus2 = os.cpus();

  let idleDelta = 0, totalDelta = 0;
  for (let i = 0; i < cpus1.length; i++) {
    const c1 = cpus1[i].times, c2 = cpus2[i].times;
    const idle = c2.idle - c1.idle;
    const total = (c2.user + c2.nice + c2.sys + c2.idle + c2.irq) - (c1.user + c1.nice + c1.sys + c1.idle + c1.irq);
    idleDelta += idle;
    totalDelta += total;
  }
  return totalDelta > 0 ? ((1 - idleDelta / totalDelta) * 100) : 0;
}

function getDiskUsage(): { used: number; total: number } {
  try {
    if (process.platform === 'win32') {
      // Use wmic on Windows
      const output = execSync('wmic logicaldisk where "DeviceID=\'C:\'" get FreeSpace,Size /format:csv', { encoding: 'utf-8', stdio: ['pipe', 'pipe', 'ignore'] });
      const lines = output.trim().split('\n').filter((l) => l.includes(','));
      if (lines.length > 0) {
        const parts = lines[lines.length - 1].split(',');
        const free = parseInt(parts[1], 10) / (1024 * 1024 * 1024);
        const total = parseInt(parts[2], 10) / (1024 * 1024 * 1024);
        return { used: total - free, total };
      }
    } else {
      const output = execSync('df -k /data 2>/dev/null || df -k /', { encoding: 'utf-8', stdio: ['pipe', 'pipe', 'ignore'] });
      const lines = output.trim().split('\n');
      if (lines.length >= 2) {
        const parts = lines[1].split(/\s+/);
        const total = parseInt(parts[1], 10) / (1024 * 1024);
        const used = parseInt(parts[2], 10) / (1024 * 1024);
        return { used, total };
      }
    }
  } catch {}
  return { used: 0, total: 0 };
}

async function isJellyfinReachable(): Promise<{ reachable: boolean; version: string | null }> {
  try {
    const res = await fetch(`${JELLYFIN_ADAPTER_URL}/health`, { signal: AbortSignal.timeout(3000) });
    if (res.ok) {
      const data: any = await res.json();
      return { reachable: data.jellyfin_reachable ?? false, version: data.jellyfin_version ?? null };
    }
  } catch {}
  return { reachable: false, version: null };
}

async function isWanConnected(): Promise<boolean> {
  try {
    await fetch('https://1.1.1.1', { method: 'HEAD', signal: AbortSignal.timeout(3000) });
    return true;
  } catch {
    return false;
  }
}

export async function buildHeartbeatPayload(): Promise<HeartbeatPayload> {
  const cpuUsage = await getCpuUsage();
  const memTotal = os.totalmem() / (1024 * 1024 * 1024);
  const memFree = os.freemem() / (1024 * 1024 * 1024);
  const memUsed = memTotal - memFree;
  const disk = getDiskUsage();
  const jf = await isJellyfinReachable();
  const wan = await isWanConnected();

  let enrolledDevices = 0, activeSessions = 0;
  try { enrolledDevices = getEnrolledDeviceCount(); } catch {}
  try { activeSessions = getActiveSessionCount(); } catch {}

  return {
    node_id: NODE_ID,
    timestamp: new Date().toISOString(),
    version: '0.1.0',
    storage_used_gb: disk.used,
    storage_total_gb: disk.total,
    active_sessions: activeSessions,
    jellyfin_reachable: jf.reachable,
    wan_connected: wan,
    cpu_usage_pct: Math.round(cpuUsage * 100) / 100,
    memory_used_gb: Math.round(memUsed * 100) / 100,
    memory_total_gb: Math.round(memTotal * 100) / 100,
    enrolled_devices: enrolledDevices,
    pending_sync_jobs: 0,
    completed_sync_jobs_today: 0,
    failed_sync_jobs_today: 0,
    uptime_seconds: Math.floor((Date.now() - startTime) / 1000),
    jellyfin_version: jf.version,
    last_successful_sync_at: null,
  };
}

export async function sendHeartbeat() {
  if (!CLOUD_API_URL || !NODE_ID) return;

  try {
    const payload = await buildHeartbeatPayload();
    await fetch(`${CLOUD_API_URL}/api/nodes/heartbeat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-Node-Token': NODE_TOKEN },
      body: JSON.stringify(payload),
    });
  } catch {
    log('warning', 'Heartbeat failed (WAN may be down)');
  }
}
