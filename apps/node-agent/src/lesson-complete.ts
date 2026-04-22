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
  /** CORE's canonical class_id for the class watching this video. Passed so
   *  CORE can fan out the quiz (shared STB) or identify the context on the
   *  individual-device sync path without re-resolving classroom_id. */
  core_class_id: string | null;
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

/**
 * Discriminator returned by CORE:
 *  - class_fanout: shared STB, CORE published the quiz to every enrolled student.
 *  - individual:   student took the lesson on their own device, CORE returned a
 *                  direct quiz URL (+ signed JWT for pre-auth handoff).
 *  - pending:      WAN was down or CORE was unreachable — Pulse will retry via
 *                  the lesson-complete sync worker when connectivity returns.
 */
export type LessonCompleteMode = 'class_fanout' | 'individual' | 'pending';

export interface LessonCompleteResult {
  recorded: boolean;
  synced_to_core: boolean;
  mode: LessonCompleteMode;
  /** Set when mode === 'individual'. */
  core_quiz_url: string | null;
  /** Set when mode === 'class_fanout'. */
  students_notified: number | null;
}

export async function fireLessonComplete(payload: LessonCompletePayload): Promise<LessonCompleteResult> {
  const result: LessonCompleteResult = {
    recorded: false,
    synced_to_core: false,
    mode: 'pending',
    core_quiz_url: null,
    students_notified: null,
  };

  // 1. Always insert into local SQLite (authoritative record, survives WAN loss).
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

  // 2. If WAN is down, leave as pending. The sync worker retries when WAN returns.
  if (!payload.wan_connected) {
    log('info', 'lesson_complete_offline — queued for sync', { id, device_id: payload.device_id });
    return result; // mode: 'pending'
  }

  // 3. Notify CORE. One endpoint, two behaviors based on student_id presence:
  //    - with student_id    → CORE returns individual quiz_url (+ JWT)
  //    - without student_id → CORE fans out to all enrolled students, returns count
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
        core_class_id: payload.core_class_id,
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

      // Parse CORE's mode discriminator from the response.
      try {
        const body: any = await res.json();
        if (body?.mode === 'class_fanout') {
          result.mode = 'class_fanout';
          result.students_notified = typeof body.students_notified === 'number' ? body.students_notified : null;
        } else if (body?.mode === 'individual') {
          result.mode = 'individual';
          result.core_quiz_url = typeof body.quiz_url === 'string' ? body.quiz_url : null;
        } else {
          // Older CORE without the discriminator: infer from whether we had a student_id.
          result.mode = payload.student_id ? 'individual' : 'class_fanout';
        }
      } catch {
        result.mode = payload.student_id ? 'individual' : 'class_fanout';
      }

      log('info', 'lesson_complete_synced_to_core', {
        id,
        mode: result.mode,
        asset_id: payload.asset_id,
        student_id: payload.student_id,
        students_notified: result.students_notified,
      });
    } else {
      log('warning', 'lesson_complete_core_rejected', { id, status: res.status });
      // Leave as pending; sync worker retries.
    }
  } catch (err: any) {
    log('warning', 'lesson_complete_core_unreachable', { id, error: err.message });
    // Leave as pending; sync worker retries.
  }

  return result;
}
