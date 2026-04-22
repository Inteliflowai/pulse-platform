import express from 'express';
import { HEARTBEAT_INTERVAL_MS } from '@pulse/shared';
import { validateEnv } from './env';
import { log } from './logger';

validateEnv();
import { initDb, getEnrolledDevice, upsertEnrolledDevice, getClassroomCache, upsertClassroomCache, getLocalPackages, getLocalAssets, getEnrolledDeviceCount, getActiveSessionCount, insertPlaybackSession, touchDevice, createStudentSession, getStudentSession, clearStudentSession, setConductorState, getConductorState, saveLocalQuizAttempt, cacheSequence, getCachedSequences, getCachedSequence, cleanupExpiredSessions, upsertScheduleCache, deleteScheduleCacheNotIn, updateEnrolledDeviceSchedule, isStudentInClassGroup, upsertClassGroupStudent } from './db';
import { renderClassroomPlayer, ScheduleInfo } from './classroom-player';
import { sendHeartbeat } from './heartbeat';
import { startUpdateManager, setMaintenanceWindow } from './update-manager';
import { createBackup, restoreBackup, listBackups, startAutoBackup, verifyLatestBackup, getBackupStatus } from './backup';
import { collectDiagnostics } from './diagnostics';
import { jellyfinWebhookRouter } from './jellyfin-webhook';
import { fireLessonComplete, LessonCompletePayload } from './lesson-complete';
import { startLessonCompleteSync } from './lesson-complete-sync';
import { getActiveSchedule, getUpcomingSchedule, getAllSchedulesForClassroom } from './schedule-resolver';
import { idempotent } from './idempotency';

interface EnrolledDevice {
  device_id: string;
  classroom_id: string;
  local_session_token: string;
  schedule_id: string | null;
  class_group_id: string | null;
  status: string;
  ip_address: string;
}

const PORT = parseInt(process.env.PORT ?? '3100', 10);
const NODE_ID = process.env.NODE_ID ?? '';
const CLOUD_API_URL = process.env.CLOUD_API_URL ?? '';
const NODE_TOKEN = process.env.NODE_REGISTRATION_TOKEN ?? '';
const JELLYFIN_ADAPTER_URL = process.env.JELLYFIN_ADAPTER_URL ?? 'http://jellyfin-adapter:3101';
const CORE_API_URL = process.env.CORE_API_URL ?? '';

// In-memory classroom events buffer (per classroom)
const classroomEvents: Map<string, { id: string; type: string; payload: any; created_at: string }[]> = new Map();
let eventCounter = 0;

function emitClassroomEvent(classroomId: string, type: string, payload: any) {
  eventCounter++;
  const event = { id: String(eventCounter), type, payload, created_at: new Date().toISOString() };
  const events = classroomEvents.get(classroomId) ?? [];
  events.push(event);
  // Keep max 100 events per classroom
  if (events.length > 100) events.splice(0, events.length - 100);
  classroomEvents.set(classroomId, events);
  return event;
}

const app = express();
app.use(express.json());
app.use(express.static('public'));

// CORS + Security headers
app.use((_req, res, next) => {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Methods', 'GET, POST, PATCH, DELETE, OPTIONS');
  res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Node-Token');
  res.header('X-Content-Type-Options', 'nosniff');
  res.header('X-Frame-Options', 'SAMEORIGIN');
  res.header('Referrer-Policy', 'strict-origin-when-cross-origin');
  // CSP: allow inline scripts/styles (needed for self-contained classroom player)
  res.header('Content-Security-Policy', "default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; media-src 'self' *; connect-src 'self' *; frame-src 'self' *;");
  if (_req.method === 'OPTIONS') { res.sendStatus(204); return; }
  next();
});

// Rate limiter for enrollment: 10 req/min per IP
const enrollRateMap = new Map<string, { count: number; resetAt: number }>();
function checkEnrollRate(ip: string): boolean {
  const now = Date.now();
  const entry = enrollRateMap.get(ip);
  if (!entry || now > entry.resetAt) {
    enrollRateMap.set(ip, { count: 1, resetAt: now + 60_000 });
    return true;
  }
  if (entry.count >= 10) return false;
  entry.count++;
  return true;
}

// ── Jellyfin Webhook Router ──
app.use(jellyfinWebhookRouter);

// ── Health ──
app.get('/health', async (_req, res) => {
  let wanConnected = false;
  try {
    const r = await fetch(`${CLOUD_API_URL}/api/nodes/${NODE_ID}/config`, {
      headers: { 'X-Node-Token': NODE_TOKEN },
      signal: AbortSignal.timeout(5000),
    });
    wanConnected = r.ok;
  } catch { /* offline */ }

  let enrolledDevices = 0;
  let activeSessions = 0;
  try { enrolledDevices = getEnrolledDeviceCount(); } catch (e: any) { log('warning', 'Failed to get device count', { error: e.message }); }
  try { activeSessions = getActiveSessionCount(); } catch (e: any) { log('warning', 'Failed to get session count', { error: e.message }); }

  res.json({ ok: true, enrolled_devices: enrolledDevices, active_sessions: activeSessions, wan_connected: wanConnected, node_id: NODE_ID });
});

// ── Enrollment ──
app.get('/enroll', async (req, res) => {
  const code = req.query.code as string;
  const ip = req.ip ?? req.socket.remoteAddress ?? '';

  if (!code) {
    res.status(400).send(errorPage('Missing enrollment code'));
    return;
  }

  if (!checkEnrollRate(ip)) {
    res.status(429).send(errorPage('Too many enrollment attempts. Please wait and try again.'));
    return;
  }

  try {
    // Validate token with cloud
    const validateRes = await fetch(`${CLOUD_API_URL}/api/devices/validate-token?token=${code}`);
    const validation = await validateRes.json() as any;

    if (!validateRes.ok || !validation.valid) {
      res.status(400).send(errorPage(validation.error ?? 'Invalid or expired enrollment code'));
      return;
    }

    // Generate local session token
    const localSessionToken = crypto.randomUUID();

    // Save locally
    upsertEnrolledDevice(validation.device_id, validation.classroom_id, code, localSessionToken, ip);

    // Cache classroom
    if (validation.classroom_name) {
      upsertClassroomCache(validation.classroom_id, NODE_ID, validation.classroom_name, '');
    }

    // Schedule-aware enrollment: check what's active in this classroom
    const activeSchedule = getActiveSchedule(validation.classroom_id);
    const upcomingSchedule = getUpcomingSchedule(validation.classroom_id, 15);

    if (activeSchedule) {
      // Associate device with the active schedule's class group
      try {
        updateEnrolledDeviceSchedule(validation.device_id, activeSchedule.schedule_id, activeSchedule.class_group_id);
      } catch {}
    }

    // STB devices skip student validation — they are room displays
    const deviceType = validation.device_type ?? 'browser';
    if (deviceType === 'stb') {
      log('info', 'STB enrolled', { device_id: validation.device_id, classroom: validation.classroom_name });
    }

    // Update cloud
    try {
      await fetch(`${CLOUD_API_URL}/api/devices/${validation.device_id}/enroll`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-Node-Token': NODE_TOKEN },
        body: JSON.stringify({ local_session_token: localSessionToken, ip_address: ip }),
      });
    } catch {
      log('warning', 'Could not update cloud device record (WAN may be down)');
    }

    log('info', 'Device enrolled', {
      device_id: validation.device_id,
      classroom: validation.classroom_name,
      schedule: activeSchedule?.schedule_id ?? null,
      class_group: activeSchedule?.class_group_name ?? null,
    });

    // Redirect to classroom player
    res.redirect(`/classroom?token=${localSessionToken}`);

  } catch (err: any) {
    log('error', 'Enrollment error', { error: err.message });
    res.status(500).send(errorPage('Enrollment failed. Is the cloud API reachable?'));
  }
});

// ── Classroom Player ──
app.get('/classroom', async (req, res) => {
  const token = req.query.token as string;
  if (!token) { res.status(400).send(errorPage('Missing session token')); return; }

  const device = getEnrolledDevice(token) as EnrolledDevice | null;
  if (!device) { res.status(401).send(errorPage('Invalid or revoked session. Please re-enroll.')); return; }

  touchDevice(token, req.ip ?? '');

  const classroom = getClassroomCache(device.classroom_id) as any;
  const classroomName = classroom?.name ?? 'Classroom';

  // Determine WAN status
  let nodeStatus = 'offline';
  try {
    await fetch(`${CLOUD_API_URL}/api/nodes/${NODE_ID}/config`, { signal: AbortSignal.timeout(3000), headers: { 'X-Node-Token': NODE_TOKEN } });
    nodeStatus = 'online';
  } catch { /* offline */ }

  // Get schedule info for the classroom
  const active = getActiveSchedule(device.classroom_id);
  const upcoming = getUpcomingSchedule(device.classroom_id, 15);
  const scheduleInfo = active ? {
    class_group_name: active.class_group_name,
    sequence_name: active.sequence_name,
    teacher_name: active.teacher_name,
    minutes_remaining: active.minutes_remaining,
    upcoming_class: null,
    upcoming_minutes: null,
  } : upcoming ? {
    class_group_name: null,
    sequence_name: null,
    teacher_name: null,
    minutes_remaining: null,
    upcoming_class: upcoming.class_group_name,
    upcoming_minutes: upcoming.minutes_remaining,
  } : null;

  res.type('html').send(renderClassroomPlayer(classroomName, token, nodeStatus, scheduleInfo));
});

// ── Classroom status (polled by player) ──
app.get('/classroom-status', async (req, res) => {
  const token = req.query.token as string;
  if (!token) { res.status(400).json({ error: 'Missing token' }); return; }
  const device = getEnrolledDevice(token) as EnrolledDevice | null;
  if (!device) { res.status(401).json({ error: 'Invalid token' }); return; }

  touchDevice(token, req.ip ?? '');

  const packages = await getLocalPackages();
  const assets = await getLocalAssets();

  res.json({ classroom_id: device.classroom_id, packages: packages.length, assets: assets.length, updated_at: new Date().toISOString() });
});

// ── Classroom events (polled by player for lesson_complete etc.) ──
app.get('/classroom-events', (req, res) => {
  const token = req.query.token as string;
  const afterId = req.query.after as string | undefined;
  if (!token) { res.status(400).json({ error: 'Missing token' }); return; }

  const device = getEnrolledDevice(token) as EnrolledDevice | null;
  if (!device) { res.status(401).json({ error: 'Invalid token' }); return; }

  const events = classroomEvents.get(device.classroom_id) ?? [];
  let filtered = events;
  if (afterId) {
    const idx = events.findIndex(e => e.id === afterId);
    filtered = idx >= 0 ? events.slice(idx + 1) : events;
  }

  res.json({ events: filtered.map(e => ({ id: e.id, type: e.type, ...e.payload, created_at: e.created_at })) });
});

// ── Current schedule (polled by STB and classroom player) ──
app.get('/classroom/current-schedule', (req, res) => {
  const token = req.query.token as string;
  if (!token) { res.status(400).json({ error: 'Missing token' }); return; }

  const device = getEnrolledDevice(token) as EnrolledDevice | null;
  if (!device) { res.status(401).json({ error: 'Invalid token' }); return; }

  const active = getActiveSchedule(device.classroom_id);
  const upcoming = getUpcomingSchedule(device.classroom_id, 15);
  const daySchedule = getAllSchedulesForClassroom(device.classroom_id, new Date());

  res.json({
    active,
    upcoming,
    day_schedule: daySchedule,
    server_time: new Date().toISOString(),
  });
});

// ── Student class group validation ──
app.get('/classroom/validate-student', (req, res) => {
  const token = req.query.token as string;
  const studentId = req.query.student_id as string;
  if (!token || !studentId) { res.status(400).json({ error: 'Missing params' }); return; }

  const device = getEnrolledDevice(token) as EnrolledDevice | null;
  if (!device) { res.status(401).json({ error: 'Invalid token' }); return; }

  const active = getActiveSchedule(device.classroom_id);
  if (!active) {
    res.json({ valid: true, reason: 'no_active_schedule' });
    return;
  }

  const inGroup = isStudentInClassGroup(studentId, active.class_group_id);
  res.json({
    valid: inGroup,
    class_group_name: active.class_group_name,
    reason: inGroup ? 'in_class_group' : 'not_in_class_group',
  });
});

// ── Lesson-complete (called by classroom player when video ends) ──
app.post('/lesson-complete', idempotent('lesson-complete'), async (req, res) => {
  const { token, asset_id, sequence_id, sequence_item_index, student_id, watch_pct, watch_duration_seconds } = req.body;
  if (!token) { res.status(400).json({ error: 'Missing token' }); return; }

  const device = getEnrolledDevice(token) as EnrolledDevice | null;
  if (!device) { res.status(401).json({ error: 'Invalid token' }); return; }

  // Determine WAN
  let wanConnected = false;
  try {
    await fetch(`${CLOUD_API_URL}/api/health`, { signal: AbortSignal.timeout(5000) });
    wanConnected = true;
  } catch { /* offline */ }

  const classroom = getClassroomCache(device.classroom_id) as any;
  const deliveryMode = classroom?.delivery_mode === 'pulse_stb' ? 'pulse_stb' : 'pulse_local';

  // Pull core_class_id from the currently-active schedule so CORE can route
  // the quiz fan-out (shared STB) without a classroom_id→class_id lookup.
  const activeSchedule = getActiveSchedule(device.classroom_id);
  const coreClassId = activeSchedule?.core_class_id ?? null;

  const payload: LessonCompletePayload = {
    node_id: NODE_ID,
    classroom_id: device.classroom_id,
    core_class_id: coreClassId,
    asset_id: asset_id ?? '',
    sequence_id: sequence_id ?? null,
    sequence_item_index: sequence_item_index ?? null,
    student_id: student_id ?? null,
    device_id: device.device_id,
    watch_pct: watch_pct ?? 100,
    watch_duration_seconds: watch_duration_seconds ?? 0,
    delivery_mode: deliveryMode as 'pulse_local' | 'pulse_stb',
    completed_at: new Date().toISOString(),
    wan_connected: wanConnected,
    session_token: token,
  };

  const result = await fireLessonComplete(payload);

  // Event payload follows the mode CORE decided (or 'pending' if WAN is down
  // or CORE was unreachable). The classroom player / STB overlay branches on
  // `mode` to decide whether to redirect, show a fan-out notice, or show the
  // "quiz pending" holding screen.
  const eventPayload: Record<string, any> = {
    mode: result.mode,
    asset_id: asset_id,
    device_id: device.device_id,
  };
  if (result.mode === 'individual' && result.core_quiz_url) {
    eventPayload.core_quiz_url = result.core_quiz_url;
  }
  if (result.mode === 'class_fanout') {
    eventPayload.students_notified = result.students_notified ?? 0;
  }

  // Emit to classroom events buffer
  emitClassroomEvent(device.classroom_id, 'lesson_complete', eventPayload);

  res.json({ ok: true, event: { type: 'lesson_complete', ...eventPayload } });
});

// ── Packages (offline-capable content source) ──
app.get('/packages', async (req, res) => {
  const token = req.query.token as string;
  if (!token) { res.status(400).json({ error: 'Missing token' }); return; }
  const device = getEnrolledDevice(token) as EnrolledDevice | null;
  if (!device) { res.status(401).json({ error: 'Invalid token' }); return; }

  touchDevice(token, req.ip ?? '');

  const packages = getLocalPackages();
  const allAssets = getLocalAssets();
  const assetMap = new Map(allAssets.map((a: any) => [a.asset_id, a]));

  const result = packages.map((pkg: any) => {
    const manifest = typeof pkg.manifest === 'string' ? JSON.parse(pkg.manifest) : pkg.manifest;
    const pkgAssets = (manifest?.assets ?? []).map((ma: any) => {
      const local = assetMap.get(ma.asset_id);
      return {
        asset_id: ma.asset_id,
        filename: ma.filename ?? local?.filename,
        mime_type: ma.mime_type ?? '',
        size_bytes: ma.size_bytes ?? 0,
        stream_url: local?.jellyfin_item_id ? `/stream/${ma.asset_id}?token=${token}` : null,
      };
    });
    return { package_id: pkg.package_id, name: pkg.name, version: pkg.version, assets: pkgAssets };
  });

  res.json({ packages: result });
});

// ── Stream redirect ──
app.get('/stream/:assetId', async (req, res) => {
  const token = req.query.token as string;
  const { assetId } = req.params;
  if (!token) { res.status(400).json({ error: 'Missing token' }); return; }

  const device = getEnrolledDevice(token) as EnrolledDevice | null;
  if (!device) { res.status(401).json({ error: 'Invalid token' }); return; }

  try {
    const adapterRes = await fetch(`${JELLYFIN_ADAPTER_URL}/assets/${assetId}/stream-url?device_id=${device.device_id}`);
    if (!adapterRes.ok) { res.status(404).json({ error: 'Asset not available' }); return; }

    const data = await adapterRes.json() as any;

    // Log playback session
    const sessionId = crypto.randomUUID();
    try {
      insertPlaybackSession(sessionId, device.device_id, assetId);
    } catch { /* non-critical */ }

    log('info', 'Stream started', { asset_id: assetId, device_id: device.device_id });

    res.redirect(data.stream_url);
  } catch (err: any) {
    log('error', 'Stream error', { asset_id: assetId, error: err.message });
    res.status(500).json({ error: 'Failed to get stream URL' });
  }
});

// ── Sequences (learning flow) ──
app.get('/sequences', async (req, res) => {
  const token = req.query.token as string;
  if (!token) { res.status(400).json({ error: 'Missing token' }); return; }
  const device = getEnrolledDevice(token) as EnrolledDevice | null;
  if (!device) { res.status(401).json({ error: 'Invalid token' }); return; }

  touchDevice(token, req.ip ?? '');

  // Try fetching from cloud, fall back to local cache
  try {
    const cloudRes = await fetch(`${CLOUD_API_URL}/api/curriculum/sequences`, { signal: AbortSignal.timeout(5000), headers: { 'X-Node-Token': NODE_TOKEN } });
    if (cloudRes.ok) {
      const data: any = await cloudRes.json();
      const sequences = (data.sequences ?? []).filter((s: any) => s.status === 'published');

      // Enrich with local stream URLs
      const allAssets = getLocalAssets();
      const assetMap = new Map((allAssets as any[]).map((a: any) => [a.asset_id, a]));

      const enriched = [];
      for (const seq of sequences) {
        const itemsRes = await fetch(`${CLOUD_API_URL}/api/curriculum/sequences/${seq.id}`, { signal: AbortSignal.timeout(5000), headers: { 'X-Node-Token': NODE_TOKEN } });
        if (!itemsRes.ok) continue;
        const itemsData: any = await itemsRes.json();

        const items = (itemsData.items ?? []).map((item: any) => {
          const localAsset = item.asset_id ? assetMap.get(item.asset_id) : null;
          return {
            ...item,
            stream_url: localAsset ? `/stream/${item.asset_id}?token=${token}` : null,
            quiz: item.quiz_id ? item.quiz_definitions : null,
          };
        });

        // Fetch quiz questions for quiz items
        for (const item of items) {
          if (item.item_type === 'quiz' && item.quiz_id) {
            try {
              const quizRes = await fetch(`${CLOUD_API_URL}/api/quiz/${item.quiz_id}`, { signal: AbortSignal.timeout(5000), headers: { 'X-Node-Token': NODE_TOKEN } });
              if (quizRes.ok) {
                const quizData: any = await quizRes.json();
                item.quiz = { ...quizData.quiz, questions: quizData.questions };
              }
            } catch { /* use cached if available */ }
          }
        }

        const seqData = {
          id: seq.id,
          name: seq.name,
          grade: (seq as any).grades?.name ?? '',
          subject: (seq as any).subjects?.name ?? '',
          items,
        };
        enriched.push(seqData);

        // Cache for offline use — pass cloud updated_at for LWW conflict resolution.
        try {
          cacheSequence(seq.id, seq.name, seqData.grade, seqData.subject, seq.grade_id ?? '', seq.subject_id ?? '', items, (seq as any).updated_at);
        } catch {}
      }

      res.json({ sequences: enriched });
      return;
    }
  } catch {
    // Cloud unreachable — serve from local cache
  }

  // Fallback: serve cached sequences
  const allAssets = getLocalAssets();
  const assetMap = new Map((allAssets as any[]).map((a: any) => [a.asset_id, a]));
  const cached = getCachedSequences() as any[];
  const enriched = cached.map((seq: any) => {
    const items = (typeof seq.items === 'string' ? JSON.parse(seq.items) : seq.items ?? []).map((item: any) => {
      const localAsset = item.asset_id ? assetMap.get(item.asset_id) : null;
      return { ...item, stream_url: localAsset ? `/stream/${item.asset_id}?token=${token}` : null };
    });
    return { id: seq.sequence_id, name: seq.name, grade: seq.grade, subject: seq.subject, items };
  });
  res.json({ sequences: enriched });
});

// Get single sequence with items
app.get('/sequences/:seqId', async (req, res) => {
  const token = req.query.token as string;
  if (!token) { res.status(400).json({ error: 'Missing token' }); return; }
  const device = getEnrolledDevice(token) as EnrolledDevice | null;
  if (!device) { res.status(401).json({ error: 'Invalid token' }); return; }

  try {
    const cloudRes = await fetch(`${CLOUD_API_URL}/api/curriculum/sequences/${req.params.seqId}`, { signal: AbortSignal.timeout(5000), headers: { 'X-Node-Token': NODE_TOKEN } });
    if (cloudRes.ok) {
      const data: any = await cloudRes.json();
      const allAssets = getLocalAssets();
      const assetMap = new Map((allAssets as any[]).map((a: any) => [a.asset_id, a]));

      const items = (data.items ?? []).map((item: any) => {
        const localAsset = item.asset_id ? assetMap.get(item.asset_id) : null;
        return {
          ...item,
          stream_url: localAsset ? `/stream/${item.asset_id}?token=${token}` : null,
        };
      });

      // Load quiz questions
      for (const item of items) {
        if (item.item_type === 'quiz' && item.quiz_id) {
          try {
            const quizRes = await fetch(`${CLOUD_API_URL}/api/quiz/${item.quiz_id}`, { signal: AbortSignal.timeout(5000), headers: { 'X-Node-Token': NODE_TOKEN } });
            if (quizRes.ok) {
              const quizData: any = await quizRes.json();
              item.quiz = { ...quizData.quiz, questions: quizData.questions };
            }
          } catch {}
        }
      }

      res.json({ ...data.sequence, items });
      return;
    }
  } catch {}

  // Fallback: cached sequence
  const cached = getCachedSequence(req.params.seqId) as any;
  if (cached) {
    const allAssets = getLocalAssets();
    const assetMap = new Map((allAssets as any[]).map((a: any) => [a.asset_id, a]));
    const items = (typeof cached.items === 'string' ? JSON.parse(cached.items) : cached.items ?? []).map((item: any) => {
      const localAsset = item.asset_id ? assetMap.get(item.asset_id) : null;
      return { ...item, stream_url: localAsset ? `/stream/${item.asset_id}?token=${token}` : null };
    });
    res.json({ id: cached.sequence_id, name: cached.name, items });
    return;
  }

  res.status(404).json({ error: 'Sequence not found' });
});

// ── Student search + login ──
app.get('/students/search', async (req, res) => {
  const token = req.query.token as string;
  const q = req.query.q as string;
  if (!token || !q) { res.json({ students: [] }); return; }

  const device = getEnrolledDevice(token) as EnrolledDevice | null;
  if (!device) { res.status(401).json({ error: 'Invalid token' }); return; }

  // Search students from cloud
  try {
    const cloudRes = await fetch(`${CLOUD_API_URL}/api/curriculum`, { signal: AbortSignal.timeout(5000), headers: { 'X-Node-Token': NODE_TOKEN } });
    if (!cloudRes.ok) { res.json({ students: [] }); return; }

    // For now, search users with role 'student' from the cloud
    // In production, this should use a dedicated student search endpoint
    res.json({ students: [] }); // Students need to be provisioned first
  } catch {
    res.json({ students: [] });
  }
});

app.post('/students/login', (req, res) => {
  const { token, student_id, student_number } = req.body;
  if (!token) { res.status(400).json({ error: 'Missing token' }); return; }

  const device = getEnrolledDevice(token) as EnrolledDevice | null;
  if (!device) { res.status(401).json({ error: 'Invalid token' }); return; }

  // For beta: accept student number directly and create a session
  const sid = student_id || crypto.randomUUID();
  const name = student_number || 'Student';

  try {
    createStudentSession(crypto.randomUUID(), token, sid, name, student_number || '', '', []);
  } catch {}

  log('info', 'Student logged in', { student_id: sid, student_name: name, device_id: device.device_id });

  res.json({ student: { id: sid, name, student_number: student_number || '', grade_id: '', class_group_ids: [] } });
});

app.post('/students/logout', (req, res) => {
  const { token } = req.body;
  if (token) { try { clearStudentSession(token); } catch {} }
  res.json({ ok: true });
});

// ── Quiz submission ──
app.post('/quiz/submit', idempotent('quiz-submit'), (req, res) => {
  const { token, quiz_id, answers, score, max_score, percentage, passed, time_spent, student_id, student_name } = req.body;
  if (!token || !quiz_id) { res.status(400).json({ error: 'Missing fields' }); return; }

  const device = getEnrolledDevice(token) as EnrolledDevice | null;
  if (!device) { res.status(401).json({ error: 'Invalid token' }); return; }

  const attemptId = crypto.randomUUID();
  log('info', 'Quiz submitted', { quiz_id, score, max_score, percentage, passed, student_id, student_name });

  // Save locally
  try {
    saveLocalQuizAttempt(attemptId, quiz_id, student_id || device.device_id, student_name || 'Unknown', score, max_score, percentage, passed, answers);
  } catch (e: any) { log('warning', 'Failed to save quiz attempt locally', { error: e.message }); }

  // Sync to cloud
  fetch(`${CLOUD_API_URL}/api/progress`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'X-Node-Token': NODE_TOKEN },
    body: JSON.stringify({
      quiz_attempts: [{
        id: attemptId, quiz_id, student_id: student_id || device.device_id,
        score, max_score, percentage, passed, status: 'completed',
        completed_at: new Date().toISOString(),
        responses: Object.entries(answers || {}).map(([qId, optId]) => ({
          id: crypto.randomUUID(), question_id: qId, answer: optId, is_correct: null, points_earned: 0,
        })),
      }],
    }),
  }).catch(() => { log('warning', 'Could not sync quiz to cloud'); });

  res.json({ ok: true, score, max_score, percentage, passed });
});

// ── Conductor state (for student devices to poll) ──
app.get('/conductor/state', (req, res) => {
  const token = req.query.token as string;
  if (!token) { res.json({ active: false }); return; }
  const device = getEnrolledDevice(token) as EnrolledDevice | null;
  if (!device) { res.json({ active: false }); return; }

  const state = getConductorState(device.classroom_id) as any;
  if (state && state.status === 'active') {
    res.json({ active: true, sequence_id: state.sequence_id, current_item_index: state.current_item_index });
  } else {
    res.json({ active: false });
  }
});

// ── Conductor control (teacher pushes state) ──
app.post('/conductor/update', (req, res) => {
  const { token, classroom_id, sequence_id, current_item_index, status, client_updated_at } = req.body;
  if (!token || !classroom_id || !sequence_id) { res.status(400).json({ error: 'Missing fields' }); return; }

  const device = getEnrolledDevice(token) as EnrolledDevice | null;
  if (!device) { res.status(401).json({ error: 'Invalid token' }); return; }

  // LWW: client sends its local timestamp; stale writes from a lagging device are dropped.
  setConductorState(classroom_id, sequence_id, current_item_index ?? 0, status ?? 'active', device.device_id, client_updated_at);
  log('info', 'Conductor state updated', { classroom_id, sequence_id, current_item_index });

  res.json({ ok: true });
});

app.post('/conductor/end', (req, res) => {
  const { token, classroom_id } = req.body;
  if (!token || !classroom_id) { res.status(400).json({ error: 'Missing fields' }); return; }

  const state = getConductorState(classroom_id) as any;
  if (state) {
    setConductorState(classroom_id, state.sequence_id, state.current_item_index, 'completed', state.teacher_id);
  }
  res.json({ ok: true });
});

// ── Conductor page (teacher view) ──
app.get('/conductor', async (req, res) => {
  const token = req.query.token as string;
  if (!token) { res.status(400).send(errorPage('Missing token')); return; }
  const device = getEnrolledDevice(token) as EnrolledDevice | null;
  if (!device) { res.status(401).send(errorPage('Invalid token')); return; }

  res.type('html').send(renderConductorPage(token));
});

function renderConductorPage(token: string): string {
  return `<!DOCTYPE html><html lang="en"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1,user-scalable=no"><title>Teacher Conductor — Pulse</title>
<style>
*{margin:0;padding:0;box-sizing:border-box}body{font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;background:#0f1117;color:#e5e7eb;min-height:100vh;overflow-x:hidden}
.header{background:#1e2130;border-bottom:1px solid #374151;padding:12px 24px;display:flex;align-items:center;gap:10px}
.header h1{font-size:16px;font-weight:700}.header .sub{font-size:11px;color:#9ca3af;margin-left:auto}
.content{padding:20px;max-width:800px;margin:0 auto}
.controls{display:flex;gap:8px;margin:16px 0;flex-wrap:wrap}
.btn{padding:8px 16px;background:#6366f1;color:#fff;border:none;border-radius:6px;cursor:pointer;font-size:13px;font-weight:600;-webkit-tap-highlight-color:transparent}
.btn:hover{background:#4f46e5}.btn:active{transform:scale(.97)}
.btn-outline{background:transparent;border:1px solid #4b5563;color:#e5e7eb}
.btn-danger{background:transparent;border:1px solid #ef4444;color:#ef4444}
.btn-amber{background:#d97706;color:#fff}
.item-list{margin:8px 0}
.item{padding:12px;background:#1e2130;border:1px solid #374151;border-radius:8px;margin:6px 0;display:flex;align-items:center;gap:12px;cursor:pointer}
.item.active{border-color:#6366f1;background:rgba(99,102,241,.08)}
.item-num{width:28px;height:28px;border-radius:50%;background:#374151;display:flex;align-items:center;justify-content:center;font-size:11px;font-weight:600;flex-shrink:0}
.item.active .item-num{background:#6366f1}
/* Mobile conductor */
.m-wrap{display:flex;flex-direction:column;height:100vh;height:100dvh}
.m-top{background:#1e2130;padding:12px 16px;display:flex;justify-content:space-between;align-items:center;border-bottom:1px solid #374151}
.m-top .name{font-size:14px;font-weight:700;max-width:50%;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.m-top .time{font-size:12px;color:#a5b4fc;font-weight:600}
.m-center{flex:1;display:flex;flex-direction:column;align-items:center;justify-content:center;padding:24px;touch-action:pan-y}
.m-icon{font-size:48px;margin-bottom:16px}
.m-title{font-size:1.4rem;font-weight:700;text-align:center;line-height:1.3;margin-bottom:8px}
.m-type{font-size:13px;color:#9ca3af}
.m-actions{padding:16px;display:flex;flex-direction:column;gap:10px}
.m-btn{min-height:64px;width:100%;border:none;border-radius:12px;font-size:16px;font-weight:700;cursor:pointer;display:flex;align-items:center;justify-content:center;gap:8px;-webkit-tap-highlight-color:transparent}
.m-btn:active{transform:scale(.97)}
.m-btn-next{background:#06b6d4;color:#fff}
.m-btn-pause{background:#d97706;color:#fff}
.m-btn-end{background:transparent;border:2px solid #ef4444;color:#ef4444}
.m-dots{display:flex;gap:6px;justify-content:center;padding:12px}
.m-dot{width:10px;height:10px;border-radius:50%;background:#374151}
.m-dot.done{background:#6366f1;opacity:.5}.m-dot.act{background:#06b6d4;transform:scale(1.3)}
.m-stats{display:flex;justify-content:space-around;padding:8px 16px;background:#1e2130;border-top:1px solid #374151;font-size:11px;color:#9ca3af}
.m-stats span{display:flex;align-items:center;gap:4px}
@media(min-width:768px){.m-wrap{display:none}}
@media(max-width:767px){.d-wrap{display:none}}
</style></head><body>
<!-- Desktop conductor -->
<div class="d-wrap">
<div class="header"><div style="width:28px;height:28px;background:#6366f1;border-radius:6px;display:flex;align-items:center;justify-content:center;font-weight:700;font-size:14px;color:#fff">P</div><h1>Teacher Conductor</h1><div class="sub" id="d-sched"></div></div>
<div class="content" id="d-content"><p style="color:#9ca3af">Loading sequences...</p></div>
</div>
<!-- Mobile conductor -->
<div class="m-wrap" id="m-wrap">
<div class="m-top"><div class="name" id="m-class">Classroom</div><div class="time" id="m-time"></div></div>
<div class="m-center" id="m-center"><p style="color:#9ca3af">Loading...</p></div>
<div class="m-dots" id="m-dots"></div>
<div class="m-actions" id="m-actions"></div>
<div class="m-stats" id="m-stats"></div>
</div>
<script>
(function(){
var TOKEN='${token}',currentSeq=null,currentIdx=0,isMobile=window.innerWidth<768,startX=0,startY=0,sessionStart=null;
function E(s){if(!s)return'';var d=document.createElement('div');d.textContent=s;return d.innerHTML}
function load(){
  fetch('/sequences?token='+TOKEN).then(function(r){return r.json()}).then(function(d){
    if(!d.sequences||!d.sequences.length){
      ct().innerHTML='<p style="color:#9ca3af;padding:40px;text-align:center">No published sequences</p>';
      if(isMobile)document.getElementById('m-center').innerHTML='<p style="color:#9ca3af">No published sequences</p>';
      return;
    }
    var h='<h2 style="margin-bottom:12px">Select a Sequence</h2>';
    d.sequences.forEach(function(s){
      h+='<div class="item" onclick="selectSeq(\\''+s.id+'\\')"><div class="item-num">&#9654;</div><div><div style="font-weight:500;font-size:14px">'+E(s.name)+'</div><div style="font-size:11px;color:#9ca3af">'+(s.items?s.items.length:0)+' items</div></div></div>';
    });
    ct().innerHTML=h;
    if(isMobile){
      var mh='';d.sequences.forEach(function(s){
        mh+='<div style="padding:16px;background:#1e2130;border:1px solid #374151;border-radius:12px;margin:8px 0;cursor:pointer" onclick="selectSeq(\\''+s.id+'\\')"><div style="font-size:16px;font-weight:600">'+E(s.name)+'</div><div style="font-size:12px;color:#9ca3af;margin-top:4px">'+(s.items?s.items.length:0)+' items</div></div>';
      });
      document.getElementById('m-center').innerHTML=mh;
      document.getElementById('m-actions').innerHTML='';
      document.getElementById('m-dots').innerHTML='';
    }
  });
}
function ct(){return document.getElementById('d-content')}
window.selectSeq=function(id){
  fetch('/sequences/'+id+'?token='+TOKEN).then(function(r){return r.json()}).then(function(s){
    currentSeq=s;currentIdx=0;sessionStart=Date.now();pushState();render();
  });
};
function render(){renderDesktop();if(isMobile)renderMobile();}
function renderDesktop(){
  var items=currentSeq.items||[];
  var h='<h2>'+E(currentSeq.name)+'</h2><div class="controls"><button class="btn" onclick="goPrev()">&#9664; Previous</button><button class="btn" onclick="goNext()">Next &#9654;</button><button class="btn btn-outline" onclick="endSession()">End Session</button><button class="btn btn-outline" onclick="load()">Back</button></div>';
  h+='<div class="item-list">';
  items.forEach(function(it,i){
    h+='<div class="item'+(i===currentIdx?' active':'')+'" onclick="goTo('+i+')"><div class="item-num">'+(i+1)+'</div><div><div style="font-weight:500;font-size:13px">'+E(it.title)+'</div><div style="font-size:11px;color:#9ca3af">'+it.item_type+'</div></div></div>';
  });
  h+='</div>';
  if(items[currentIdx]){
    var cur=items[currentIdx];
    h+='<div style="margin-top:16px;padding:16px;background:#1e2130;border:1px solid #6366f1;border-radius:8px"><div style="font-size:12px;color:#9ca3af">Now showing:</div><div style="font-size:16px;font-weight:600;margin-top:4px">'+E(cur.title)+'</div><div style="font-size:12px;color:#9ca3af;margin-top:4px">Type: '+cur.item_type+'</div></div>';
  }
  ct().innerHTML=h;
}
function renderMobile(){
  var items=currentSeq.items||[];
  var cur=items[currentIdx];
  if(!cur){document.getElementById('m-center').innerHTML='<p style="color:#9ca3af">No items</p>';return;}
  var icon=cur.item_type==='video'?'&#9654;&#65039;':cur.item_type==='quiz'?'&#10067;':cur.item_type==='document'?'&#128196;':'&#9749;';
  document.getElementById('m-center').innerHTML='<div class="m-icon">'+icon+'</div><div class="m-title">'+E(cur.title)+'</div><div class="m-type">'+(currentIdx+1)+' of '+items.length+' &middot; '+cur.item_type+'</div>';
  // Dots
  var dots='';items.forEach(function(_,i){dots+='<div class="m-dot'+(i<currentIdx?' done':'')+(i===currentIdx?' act':'')+'"></div>'});
  document.getElementById('m-dots').innerHTML=dots;
  // Actions
  var canNext=currentIdx<items.length-1;
  var a='';
  if(canNext)a+='<button class="m-btn m-btn-next" onclick="goNext()">&#9193; Next Item</button>';
  a+='<button class="m-btn m-btn-end" onclick="confirmEnd()">&#9209; End Session</button>';
  document.getElementById('m-actions').innerHTML=a;
  // Stats
  var elapsed=sessionStart?Math.floor((Date.now()-sessionStart)/60000):0;
  document.getElementById('m-stats').innerHTML='<span>&#128101; '+items.length+' items</span><span>&#9989; '+(currentIdx+1)+'/'+items.length+'</span><span>&#9202; '+elapsed+'m</span>';
}
function pushState(){
  fetch('/conductor/update',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({token:TOKEN,classroom_id:currentSeq.classroom_id||'default',sequence_id:currentSeq.id,current_item_index:currentIdx,status:'active'})}).catch(function(){});
}
window.goNext=function(){if(currentSeq&&currentIdx<(currentSeq.items||[]).length-1){currentIdx++;pushState();render();}};
window.goPrev=function(){if(currentIdx>0){currentIdx--;pushState();render();}};
window.goTo=function(i){currentIdx=i;pushState();render();};
window.endSession=function(){
  fetch('/conductor/end',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({token:TOKEN,classroom_id:currentSeq.classroom_id||'default'})}).then(function(){currentSeq=null;sessionStart=null;load()}).catch(function(){});
};
window.confirmEnd=function(){
  if(confirm('End this session?'))endSession();
};
// Touch gestures for mobile
if(isMobile){
  var mc=document.getElementById('m-center');
  mc.addEventListener('touchstart',function(e){startX=e.touches[0].clientX;startY=e.touches[0].clientY},{passive:true});
  mc.addEventListener('touchend',function(e){
    if(!currentSeq)return;
    var dx=e.changedTouches[0].clientX-startX,dy=e.changedTouches[0].clientY-startY;
    if(Math.abs(dx)<50||Math.abs(dy)>Math.abs(dx))return;
    if(dx<-50)goNext();else if(dx>50)goPrev();
  },{passive:true});
}
// Schedule info
fetch('/classroom/current-schedule?token='+TOKEN).then(function(r){return r.json()}).then(function(d){
  if(d.active){
    document.getElementById('d-sched').textContent=d.active.class_group_name+' \\u00b7 '+d.active.minutes_remaining+'min left';
    document.getElementById('m-class').textContent=d.active.class_group_name||'Classroom';
    document.getElementById('m-time').textContent=d.active.minutes_remaining+'min left';
  }
}).catch(function(){});
// Update stats every 30s
setInterval(function(){if(currentSeq&&isMobile)renderMobile()},30000);
load();
})();
</script></body></html>`;
}

// ── Backup endpoints ──
app.post('/backup', (_req, res) => {
  const path = createBackup();
  if (path) res.json({ ok: true, path });
  else res.status(500).json({ error: 'Backup failed' });
});

app.get('/backups', (_req, res) => {
  res.json({ backups: listBackups() });
});

app.post('/restore', (req, res) => {
  const { filename } = req.body;
  if (!filename) { res.status(400).json({ error: 'Missing filename' }); return; }
  const success = restoreBackup(filename);
  if (success) res.json({ ok: true });
  else res.status(500).json({ error: 'Restore failed' });
});

app.get('/backup/status', (_req, res) => {
  res.json(getBackupStatus());
});

app.post('/backup/verify-latest', (_req, res) => {
  const result = verifyLatestBackup();
  res.json(result);
});

// ── Diagnostics (remote collection) ──
app.post('/diagnostics/collect', async (req, res) => {
  // Require X-Node-Token header
  const nodeToken = req.headers['x-node-token'] as string;
  if (!nodeToken || nodeToken !== NODE_TOKEN) {
    res.status(401).json({ error: 'Unauthorized' });
    return;
  }
  try {
    const report = await collectDiagnostics();
    res.json(report);
  } catch (err: any) {
    res.status(500).json({ error: 'Diagnostics collection failed', message: err.message });
  }
});

// ── Error page helper ──
function errorPage(message: string): string {
  return `<!DOCTYPE html><html><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Pulse</title>
<style>body{font-family:sans-serif;background:#0f1117;color:#e5e7eb;display:flex;justify-content:center;align-items:center;min-height:100vh;margin:0}
.card{background:#1e2130;border:1px solid #374151;border-radius:12px;padding:40px;max-width:400px;text-align:center}
h1{color:#ef4444;margin-bottom:12px;font-size:20px}p{color:#9ca3af;font-size:14px}
</style></head><body><div class="card"><h1>Enrollment Error</h1><p>${message}</p></div></body></html>`;
}

// ── Start ──
/**
 * Sync schedules from cloud config into local SQLite cache.
 * Called after each heartbeat/config fetch cycle.
 */
async function syncSchedulesFromCloud(): Promise<void> {
  try {
    const configRes = await fetch(`${CLOUD_API_URL}/api/nodes/${NODE_ID}/config`, {
      headers: { 'X-Node-Token': NODE_TOKEN },
      signal: AbortSignal.timeout(10_000),
    });
    if (!configRes.ok) return;

    const config = await configRes.json() as any;

    // Sync schedules
    const schedules = config.schedules ?? [];
    const ids: string[] = [];
    for (const s of schedules) {
      ids.push(s.id);
      try {
        upsertScheduleCache({
          id: s.id,
          classroom_id: s.classroom_id,
          class_group_id: s.class_group_id,
          sequence_id: s.sequence_id,
          teacher_id: s.teacher_id ?? null,
          teacher_name: s.teacher_name ?? null,
          class_group_name: s.class_group_name ?? null,
          sequence_name: s.sequence_name ?? null,
          scheduled_date: s.scheduled_date ?? null,
          scheduled_time: s.scheduled_time,
          duration_minutes: s.duration_minutes ?? 60,
          recurrence: s.recurrence ?? 'once',
          recurrence_days: JSON.stringify(s.recurrence_days ?? []),
          recurrence_end_date: s.recurrence_end_date ?? null,
          status: s.status ?? 'scheduled',
          core_class_id: s.core_class_id ?? null,
        });
      } catch {}
    }
    deleteScheduleCacheNotIn(ids);

    // Sync class group students
    const classGroupStudents = config.class_group_students ?? [];
    for (const cgs of classGroupStudents) {
      try {
        upsertClassGroupStudent(
          cgs.id, cgs.class_group_id, cgs.student_id,
          cgs.student_name ?? null, cgs.student_number ?? null
        );
      } catch {}
    }

    if (schedules.length > 0) {
      log('info', 'Schedules synced from cloud', { count: schedules.length });
    }

    // Sync maintenance window from node metadata
    const classroomsList = config.classrooms ?? [];
    if (classroomsList.length > 0) {
      // Maintenance window is stored on the node, check if config includes it
      const mw = config.maintenance_window ?? config.feature_flags?.maintenance_window;
      if (mw) setMaintenanceWindow(mw);
    }
  } catch {
    // Cloud unreachable — use cached schedules
  }
}

async function main() {
  try {
    initDb();
  } catch (err: any) {
    log('warning', 'Local DB not available — running without persistence', { error: err.message });
  }

  const server = app.listen(PORT, () => {
    log('info', `Node Agent listening on port ${PORT}`);
  });

  // Start heartbeat + update manager
  const intervals: NodeJS.Timeout[] = [];
  intervals.push(setInterval(sendHeartbeat, HEARTBEAT_INTERVAL_MS));
  sendHeartbeat();
  startUpdateManager();
  startAutoBackup();
  startLessonCompleteSync();

  // Sync schedules on startup and every heartbeat cycle
  syncSchedulesFromCloud();
  intervals.push(setInterval(syncSchedulesFromCloud, HEARTBEAT_INTERVAL_MS));

  // Cleanup expired student sessions every hour
  intervals.push(setInterval(() => { try { cleanupExpiredSessions(); } catch (e: any) { log('warning', 'Session cleanup failed', { error: e.message }); } }, 60 * 60 * 1000));

  // Graceful shutdown: drain HTTP server, clear intervals so docker stop doesn't hard-kill mid-sync.
  let shuttingDown = false;
  const shutdown = (signal: string) => {
    if (shuttingDown) return;
    shuttingDown = true;
    log('info', 'Shutdown signal received', { signal });
    for (const i of intervals) clearInterval(i);
    server.close((err) => {
      if (err) log('warning', 'HTTP server close error', { error: err.message });
      process.exit(0);
    });
    // Hard-stop backstop: if server.close hangs longer than 10s, force exit.
    setTimeout(() => process.exit(1), 10_000).unref();
  };
  process.on('SIGTERM', () => shutdown('SIGTERM'));
  process.on('SIGINT', () => shutdown('SIGINT'));
}

main();
