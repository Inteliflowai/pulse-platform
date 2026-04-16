/**
 * Lesson-Complete Event — fires when a video ends on any delivery path.
 *
 * Always records locally in SQLite. Notifies CORE when WAN is up and
 * student is identified. Triggers offline fallback quiz when WAN is down.
 */

import { log } from './logger';
import { insertLessonCompletion, markLessonCompletionSynced } from './db';

const CORE_API_URL = process.env.CORE_API_URL ?? '';
const CORE_API_SECRET = process.env.CORE_API_SECRET ?? '';

export interface LessonCompletePayload {
  node_id: string;
  classroom_id: string;
  asset_id: string;
  sequence_id: string | null;
  sequence_item_index: number | null;
  student_id: string | null;
  device_id: string;
  watch_pct: number;
  watch_duration_seconds: number;
  delivery_mode: 'pulse_local' | 'pulse_stb';
  completed_at: string;
  wan_connected: boolean;
  session_token: string;
}

export interface LessonCompleteResult {
  recorded: boolean;
  synced_to_core: boolean;
  offline_fallback: boolean;
  core_quiz_url: string | null;
}

export async function fireLessonComplete(payload: LessonCompletePayload): Promise<LessonCompleteResult> {
  const result: LessonCompleteResult = {
    recorded: false,
    synced_to_core: false,
    offline_fallback: false,
    core_quiz_url: null,
  };

  // 1. Always insert into local SQLite
  const id = crypto.randomUUID();
  try {
    insertLessonCompletion(
      id,
      payload.node_id,
      payload.classroom_id,
      payload.asset_id,
      payload.sequence_id,
      payload.sequence_item_index,
      payload.student_id,
      payload.device_id,
      payload.watch_pct,
      payload.watch_duration_seconds,
      payload.delivery_mode,
      payload.completed_at
    );
    result.recorded = true;
    log('info', 'lesson_completion_recorded', {
      id,
      asset_id: payload.asset_id,
      student_id: payload.student_id,
      device_id: payload.device_id,
      watch_pct: payload.watch_pct,
    });
  } catch (err: any) {
    log('error', 'lesson_completion_insert_failed', { error: err.message });
  }

  // 2. WAN connected + student identified → notify CORE
  if (payload.wan_connected && payload.student_id) {
    try {
      const res = await fetch(`${CORE_API_URL}/api/attempts/pulse-lesson-complete`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Pulse-Secret': CORE_API_SECRET,
        },
        body: JSON.stringify({
          node_id: payload.node_id,
          classroom_id: payload.classroom_id,
          asset_id: payload.asset_id,
          sequence_id: payload.sequence_id,
          sequence_item_index: payload.sequence_item_index,
          student_id: payload.student_id,
          device_id: payload.device_id,
          watch_pct: payload.watch_pct,
          watch_duration_seconds: payload.watch_duration_seconds,
          delivery_mode: payload.delivery_mode,
          completed_at: payload.completed_at,
        }),
        signal: AbortSignal.timeout(10_000),
      });

      if (res.ok) {
        try { markLessonCompletionSynced(id); } catch {}
        result.synced_to_core = true;
        log('info', 'lesson_complete_synced_to_core', {
          id,
          asset_id: payload.asset_id,
          student_id: payload.student_id,
        });
      } else {
        log('warning', 'lesson_complete_core_rejected', {
          id,
          status: res.status,
        });
      }
    } catch (err: any) {
      log('warning', 'lesson_complete_core_unreachable', {
        id,
        error: err.message,
      });
      // Left as synced_to_core = 0 for retry by sync worker
    }
  }

  // 3. WAN connected but anonymous student → skip CORE
  if (payload.wan_connected && !payload.student_id) {
    log('info', 'lesson_complete_anonymous — no CORE notification', {
      id,
      device_id: payload.device_id,
    });
  }

  // 4. WAN down → offline fallback quiz
  if (!payload.wan_connected) {
    result.offline_fallback = true;
    log('info', 'lesson_complete_offline — queued for sync', {
      id,
      device_id: payload.device_id,
    });
  }

  return result;
}
