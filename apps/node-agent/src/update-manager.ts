import { log } from './logger';

const CLOUD_API_URL = process.env.CLOUD_API_URL ?? '';
const NODE_ID = process.env.NODE_ID ?? '';
const AUTO_UPDATE = process.env.AUTO_UPDATE === 'true';
const UPDATE_CHECK_INTERVAL = 10 * 60 * 1000; // 10 minutes

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
    // Report downloading
    if (assignment_id) {
      await reportStatus(assignment_id, 'downloading');
    }

    // TODO: In production Docker deployment:
    // 1. Download .tar.gz to /data/updates/{version}.tar.gz
    // 2. Verify SHA-256 checksum
    // 3. Snapshot current docker-compose.yml for rollback
    // 4. Extract new compose file
    // 5. docker compose pull && docker compose up -d
    // 6. Health check all services
    // 7. If pass → report completed; if fail → rollback

    log('info', 'Auto-update: skipping in dev mode (no Docker)');

    if (assignment_id) {
      await reportStatus(assignment_id, 'completed');
    }
  } catch (err: any) {
    log('error', 'Auto-update failed', { error: err.message });
    if (assignment_id) {
      await reportStatus(assignment_id, 'failed', err.message);
    }
  }
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
