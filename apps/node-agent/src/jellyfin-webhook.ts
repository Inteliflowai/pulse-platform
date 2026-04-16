/**
 * Jellyfin Webhook Handler
 *
 * Listens for Jellyfin webhook events (PlaybackStop, etc.).
 * On PlaybackStop with ≥85% completion, fires a lesson-complete event
 * and inserts a classroom_event so student devices know the video ended.
 *
 * Jellyfin sends JSON with: NotificationType, DeviceId, ItemId,
 * PlaybackPositionTicks, RunTimeTicks, etc.
 */

import express, { Router, Request, Response } from 'express';
import { log } from './logger';
import {
  getEnrolledDeviceByDeviceId,
  getClassroomCache,
  getLocalAssetByJellyfinId,
  getStudentSession,
} from './db';
import { fireLessonComplete, LessonCompletePayload } from './lesson-complete';
import { buildCoreQuizUrl } from './core-quiz-url';

const NODE_ID = process.env.NODE_ID ?? '';
const CLOUD_API_URL = process.env.CLOUD_API_URL ?? '';
const CORE_API_URL = process.env.CORE_API_URL ?? '';
const LESSON_COMPLETE_THRESHOLD = parseFloat(process.env.LESSON_COMPLETE_THRESHOLD ?? '0.85');

export const jellyfinWebhookRouter: express.Router = Router();

interface JellyfinWebhookEvent {
  NotificationType: string;
  DeviceId?: string;
  ItemId?: string;
  PlaybackPositionTicks?: number;
  RunTimeTicks?: number;
  ServerId?: string;
  [key: string]: any;
}

/**
 * Check WAN connectivity by pinging the cloud API.
 */
async function checkWan(): Promise<boolean> {
  try {
    await fetch(`${CLOUD_API_URL}/api/health`, { signal: AbortSignal.timeout(5000) });
    return true;
  } catch {
    return false;
  }
}

/**
 * POST /webhooks/jellyfin
 *
 * Receives Jellyfin notification webhooks.
 */
jellyfinWebhookRouter.post('/webhooks/jellyfin', async (req: Request, res: Response) => {
  const event: JellyfinWebhookEvent = req.body;

  if (!event || !event.NotificationType) {
    res.status(400).json({ error: 'Invalid webhook payload' });
    return;
  }

  log('info', 'jellyfin_webhook_received', {
    type: event.NotificationType,
    device_id: event.DeviceId,
    item_id: event.ItemId,
  });

  if (event.NotificationType === 'PlaybackStop') {
    await handlePlaybackStop(event, res);
    return;
  }

  // Acknowledge other event types
  res.json({ ok: true });
});

async function handlePlaybackStop(event: JellyfinWebhookEvent, res: Response) {
  const jellyfinDeviceId = event.DeviceId;
  const jellyfinItemId = event.ItemId;
  const positionTicks = event.PlaybackPositionTicks ?? 0;
  const runtimeTicks = event.RunTimeTicks ?? 1;

  if (!jellyfinDeviceId || !jellyfinItemId) {
    log('warning', 'playback_stop_missing_ids', { device_id: jellyfinDeviceId, item_id: jellyfinItemId });
    res.json({ ok: true });
    return;
  }

  // 1. Look up device in enrolled_devices
  const device = getEnrolledDeviceByDeviceId(jellyfinDeviceId) as any;
  if (!device) {
    log('info', 'playback_stop_unknown_device', { device_id: jellyfinDeviceId });
    res.json({ ok: true });
    return;
  }

  // 2. Look up classroom → get delivery_mode
  const classroom = getClassroomCache(device.classroom_id) as any;
  const deliveryMode = classroom?.delivery_mode === 'pulse_stb' ? 'pulse_stb' : 'pulse_local';

  // 3. Check completion: ≥85% watched
  const watchPct = runtimeTicks > 0 ? (positionTicks / runtimeTicks) * 100 : 0;
  if (watchPct / 100 < LESSON_COMPLETE_THRESHOLD) {
    log('info', 'playback_stopped_incomplete', {
      device_id: jellyfinDeviceId,
      item_id: jellyfinItemId,
      watch_pct: Math.round(watchPct),
      threshold: LESSON_COMPLETE_THRESHOLD,
    });
    res.json({ ok: true });
    return;
  }

  // 4. Look up asset from local_assets by jellyfin_item_id
  const asset = getLocalAssetByJellyfinId(jellyfinItemId) as any;
  if (!asset) {
    log('warning', 'playback_stop_asset_not_found', { jellyfin_item_id: jellyfinItemId });
    res.json({ ok: true });
    return;
  }

  // 5. Look up active student session for this device
  const studentSession = getStudentSession(device.local_session_token) as any;

  // 6. Check WAN connectivity
  const wanConnected = await checkWan();

  // 7. Calculate watch duration in seconds
  const watchDurationSeconds = Math.round(positionTicks / 10_000_000);

  // 8. Build and fire lesson-complete
  const payload: LessonCompletePayload = {
    node_id: NODE_ID,
    classroom_id: device.classroom_id,
    asset_id: asset.asset_id,
    sequence_id: null,
    sequence_item_index: null,
    student_id: studentSession?.student_id ?? null,
    device_id: device.device_id,
    watch_pct: Math.round(watchPct),
    watch_duration_seconds: watchDurationSeconds,
    delivery_mode: deliveryMode as 'pulse_local' | 'pulse_stb',
    completed_at: new Date().toISOString(),
    wan_connected: wanConnected,
    session_token: device.local_session_token,
  };

  const result = await fireLessonComplete(payload);

  // 9. Build classroom_event payload
  let eventPayload: Record<string, any>;

  if (wanConnected && studentSession?.student_id) {
    // CORE redirect: student devices open CORE for the quiz
    const coreQuizUrl = buildCoreQuizUrl({
      core_api_url: CORE_API_URL,
      sequence_item_id: asset.asset_id,
      student_id: studentSession.student_id,
      core_session_token: studentSession.id ?? '',
      classroom_id: device.classroom_id,
      node_id: NODE_ID,
    });
    eventPayload = {
      type: 'lesson_complete',
      asset_id: asset.asset_id,
      device_id: device.device_id,
      redirect_to_core: true,
      core_quiz_url: coreQuizUrl,
      offline_fallback: false,
    };
  } else if (!wanConnected) {
    // Offline fallback: student devices show local quiz
    eventPayload = {
      type: 'lesson_complete',
      asset_id: asset.asset_id,
      device_id: device.device_id,
      redirect_to_core: false,
      offline_fallback: true,
    };
  } else {
    // WAN up but anonymous — just notify lesson ended, no quiz
    eventPayload = {
      type: 'lesson_complete',
      asset_id: asset.asset_id,
      device_id: device.device_id,
      redirect_to_core: false,
      offline_fallback: false,
    };
  }

  log('info', 'lesson_complete_event_emitted', {
    asset_id: asset.asset_id,
    device_id: device.device_id,
    redirect_to_core: eventPayload.redirect_to_core,
    offline_fallback: eventPayload.offline_fallback,
    synced_to_core: result.synced_to_core,
  });

  res.json({ ok: true, event: eventPayload });
}
