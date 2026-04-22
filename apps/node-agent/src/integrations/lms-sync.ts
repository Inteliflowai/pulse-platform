/**
 * LMS Sync — Grade & Progress Sync to Cloud
 *
 * Batches locally-stored quiz results and progress data,
 * then syncs to the cloud when WAN connectivity is available.
 * Runs on a timer alongside the heartbeat cycle.
 */

import { log } from '../logger';

const CLOUD_API_URL = process.env.CLOUD_API_URL ?? '';
const NODE_TOKEN = process.env.NODE_REGISTRATION_TOKEN ?? '';
const SYNC_INTERVAL = 5 * 60 * 1000; // 5 minutes

let pendingResults: any[] = [];
let pendingProgress: any[] = [];

export function queueQuizResult(result: any): void {
  pendingResults.push(result);
  log('info', 'Quiz result queued for LMS sync', { quiz_id: result.quiz_id });
}

export function queueProgressUpdate(progress: any): void {
  pendingProgress.push(progress);
}

export function startLmsSync(): void {
  log('info', 'LMS sync service started');
  setInterval(syncToCloud, SYNC_INTERVAL);
}

async function syncToCloud(): Promise<void> {
  if (pendingResults.length === 0 && pendingProgress.length === 0) return;

  try {
    const payload: any = {};

    if (pendingResults.length > 0) {
      payload.quiz_attempts = [...pendingResults];
    }

    if (pendingProgress.length > 0) {
      payload.progress_records = [...pendingProgress];
    }

    const res = await fetch(`${CLOUD_API_URL}/api/progress`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-Node-Token': NODE_TOKEN },
      body: JSON.stringify(payload),
    });

    if (res.ok) {
      const syncedResults = pendingResults.length;
      const syncedProgress = pendingProgress.length;
      pendingResults = [];
      pendingProgress = [];
      log('info', 'LMS sync completed', { results: syncedResults, progress: syncedProgress });
    } else {
      log('warning', 'LMS sync failed', { status: res.status });
    }
  } catch (err: any) {
    log('warning', 'LMS sync error (WAN may be down)', { error: err.message });
    // Keep pending items for next cycle
  }
}

export function getPendingCount(): { results: number; progress: number } {
  return { results: pendingResults.length, progress: pendingProgress.length };
}
