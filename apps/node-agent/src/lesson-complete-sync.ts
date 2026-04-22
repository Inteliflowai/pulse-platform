/**
 * Lesson-Complete Sync Worker
 *
 * Every 5 minutes, syncs unsynced lesson_completions to CORE.
 * Retries up to 10 times before marking as permanently failed.
 */

import { log } from './logger';
import {
  getUnsyncedLessonCompletions,
  markLessonCompletionSynced,
  markLessonCompletionFailed,
  incrementLessonCompletionAttempts,
  getIntegrationCredential,
} from './db';

const CORE_API_URL_ENV = process.env.CORE_API_URL ?? '';
const CORE_API_SECRET_ENV = process.env.CORE_API_SECRET ?? '';
const SYNC_INTERVAL = 5 * 60 * 1000; // 5 minutes
const MAX_RETRY_ATTEMPTS = 10;

function coreCredentials(): { url: string; secret: string } {
  try {
    const cached = getIntegrationCredential('core');
    if (cached?.api_key) return { url: cached.api_url || CORE_API_URL_ENV, secret: cached.api_key };
  } catch {}
  return { url: CORE_API_URL_ENV, secret: CORE_API_SECRET_ENV };
}

export function startLessonCompleteSync(): void {
  log('info', 'Lesson-complete sync worker started', { interval_ms: SYNC_INTERVAL });
  setInterval(syncLessonCompletions, SYNC_INTERVAL);
}

async function syncLessonCompletions(): Promise<void> {
  let rows: any[];
  try {
    rows = getUnsyncedLessonCompletions();
  } catch (err: any) {
    log('warning', 'lesson_complete_sync_db_error', { error: err.message });
    return;
  }

  if (rows.length === 0) return;

  let synced = 0;
  let failed = 0;

  const { url: coreUrl, secret: coreSecret } = coreCredentials();

  for (const row of rows) {
    try {
      const res = await fetch(`${coreUrl}/api/attempts/pulse-lesson-complete`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${coreSecret}`,
        },
        body: JSON.stringify({
          node_id: row.node_id,
          classroom_id: row.classroom_id,
          core_class_id: row.core_class_id ?? null,
          asset_id: row.asset_id,
          sequence_id: row.sequence_id,
          sequence_item_index: row.sequence_item_index,
          student_id: row.student_id,
          device_id: row.device_id,
          watch_pct: typeof row.watch_pct === 'number' ? row.watch_pct / 100 : 0,
          watch_duration_seconds: row.watch_duration_seconds,
          delivery_mode: row.delivery_mode,
          completed_at: row.completed_at,
        }),
        signal: AbortSignal.timeout(10_000),
      });

      if (res.ok) {
        try { markLessonCompletionSynced(row.id); } catch {}
        synced++;
      } else {
        try { incrementLessonCompletionAttempts(row.id); } catch {}
        // Check if we've exceeded max retries
        if ((row.sync_attempts ?? 0) + 1 >= MAX_RETRY_ATTEMPTS) {
          try { markLessonCompletionFailed(row.id); } catch {}
          log('warning', 'lesson_complete_sync_permanent_failure', {
            id: row.id,
            attempts: (row.sync_attempts ?? 0) + 1,
          });
        }
        failed++;
      }
    } catch (err: any) {
      try { incrementLessonCompletionAttempts(row.id); } catch {}
      if ((row.sync_attempts ?? 0) + 1 >= MAX_RETRY_ATTEMPTS) {
        try { markLessonCompletionFailed(row.id); } catch {}
        log('warning', 'lesson_complete_sync_permanent_failure', {
          id: row.id,
          attempts: (row.sync_attempts ?? 0) + 1,
          error: err.message,
        });
      }
      failed++;
    }
  }

  if (synced > 0 || failed > 0) {
    log('info', `Synced ${synced} lesson completions to CORE`, {
      synced,
      failed,
      remaining: rows.length - synced,
    });
  }
}
