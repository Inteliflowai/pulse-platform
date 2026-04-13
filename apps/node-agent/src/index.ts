import express from 'express';
import { HEARTBEAT_INTERVAL_MS } from '@pulse/shared';
import { validateEnv } from './env';
import { log } from './logger';

validateEnv();
import { initDb, getEnrolledDevice, upsertEnrolledDevice, getClassroomCache, upsertClassroomCache, getLocalPackages, getLocalAssets, getEnrolledDeviceCount, getActiveSessionCount, insertPlaybackSession, touchDevice, createStudentSession, getStudentSession, clearStudentSession, setConductorState, getConductorState, saveLocalQuizAttempt, cacheSequence, getCachedSequences, getCachedSequence, cleanupExpiredSessions } from './db';
import { renderClassroomPlayer } from './classroom-player';
import { sendHeartbeat } from './heartbeat';
import { startUpdateManager } from './update-manager';
import { createBackup, restoreBackup, listBackups, startAutoBackup } from './backup';

interface EnrolledDevice {
  device_id: string;
  classroom_id: string;
  local_session_token: string;
  status: string;
  ip_address: string;
}

const PORT = parseInt(process.env.PORT ?? '3100', 10);
const NODE_ID = process.env.NODE_ID ?? '';
const CLOUD_API_URL = process.env.CLOUD_API_URL ?? '';
const NODE_TOKEN = process.env.NODE_REGISTRATION_TOKEN ?? '';
const JELLYFIN_ADAPTER_URL = process.env.JELLYFIN_ADAPTER_URL ?? 'http://jellyfin-adapter:3101';

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

// ── Health ──
app.get('/health', async (_req, res) => {
  let wanConnected = false;
  try {
    const r = await fetch(`${CLOUD_API_URL}/api/nodes/${NODE_ID}/config`, {
      headers: { 'x-node-secret': process.env.SUPABASE_SERVICE_ROLE_KEY ?? '' },
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

    // Update cloud
    try {
      await fetch(`${CLOUD_API_URL}/api/devices/${validation.device_id}/enroll`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ local_session_token: localSessionToken, ip_address: ip }),
      });
    } catch {
      log('warning', 'Could not update cloud device record (WAN may be down)');
    }

    log('info', 'Device enrolled', { device_id: validation.device_id, classroom: validation.classroom_name });

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
    await fetch(`${CLOUD_API_URL}/api/nodes/${NODE_ID}/config`, { signal: AbortSignal.timeout(3000), headers: { 'x-node-secret': process.env.SUPABASE_SERVICE_ROLE_KEY ?? '' } });
    nodeStatus = 'online';
  } catch { /* offline */ }

  res.type('html').send(renderClassroomPlayer(classroomName, token, nodeStatus));
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
    const cloudRes = await fetch(`${CLOUD_API_URL}/api/curriculum/sequences`, { signal: AbortSignal.timeout(5000) });
    if (cloudRes.ok) {
      const data: any = await cloudRes.json();
      const sequences = (data.sequences ?? []).filter((s: any) => s.status === 'published');

      // Enrich with local stream URLs
      const allAssets = getLocalAssets();
      const assetMap = new Map((allAssets as any[]).map((a: any) => [a.asset_id, a]));

      const enriched = [];
      for (const seq of sequences) {
        const itemsRes = await fetch(`${CLOUD_API_URL}/api/curriculum/sequences/${seq.id}`, { signal: AbortSignal.timeout(5000) });
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
              const quizRes = await fetch(`${CLOUD_API_URL}/api/quiz/${item.quiz_id}`, { signal: AbortSignal.timeout(5000) });
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

        // Cache for offline use
        try {
          cacheSequence(seq.id, seq.name, seqData.grade, seqData.subject, seq.grade_id ?? '', seq.subject_id ?? '', items);
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
    const cloudRes = await fetch(`${CLOUD_API_URL}/api/curriculum/sequences/${req.params.seqId}`, { signal: AbortSignal.timeout(5000) });
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
            const quizRes = await fetch(`${CLOUD_API_URL}/api/quiz/${item.quiz_id}`, { signal: AbortSignal.timeout(5000) });
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
    const cloudRes = await fetch(`${CLOUD_API_URL}/api/curriculum`, { signal: AbortSignal.timeout(5000) });
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
app.post('/quiz/submit', (req, res) => {
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
    headers: { 'Content-Type': 'application/json' },
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
  const { token, classroom_id, sequence_id, current_item_index, status } = req.body;
  if (!token || !classroom_id || !sequence_id) { res.status(400).json({ error: 'Missing fields' }); return; }

  const device = getEnrolledDevice(token) as EnrolledDevice | null;
  if (!device) { res.status(401).json({ error: 'Invalid token' }); return; }

  setConductorState(classroom_id, sequence_id, current_item_index ?? 0, status ?? 'active', device.device_id);
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
  return `<!DOCTYPE html><html lang="en"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Teacher Conductor — Pulse</title>
<style>*{margin:0;padding:0;box-sizing:border-box}body{font-family:sans-serif;background:#0f1117;color:#e5e7eb;min-height:100vh}
.header{background:#1e2130;border-bottom:1px solid #374151;padding:12px 24px;display:flex;align-items:center;gap:10px}
.header h1{font-size:16px;font-weight:700}
.content{padding:20px;max-width:800px;margin:0 auto}
.controls{display:flex;gap:8px;margin:16px 0}
.btn{padding:8px 16px;background:#6366f1;color:#fff;border:none;border-radius:6px;cursor:pointer;font-size:13px;font-weight:600}
.btn:hover{background:#4f46e5}
.btn-outline{background:transparent;border:1px solid #4b5563;color:#e5e7eb}
.item-list{space-y:8px}
.item{padding:12px;background:#1e2130;border:1px solid #374151;border-radius:8px;margin:6px 0;display:flex;align-items:center;gap:12px;cursor:pointer}
.item.active{border-color:#6366f1;background:#6366f1/10}
.item-num{width:28px;height:28px;border-radius:50%;background:#374151;display:flex;align-items:center;justify-content:center;font-size:11px;font-weight:600}
.item.active .item-num{background:#6366f1}
</style></head><body>
<div class="header"><div style="width:28px;height:28px;background:#6366f1;border-radius:6px;display:flex;align-items:center;justify-content:center;font-weight:700;font-size:14px;color:#fff">P</div><h1>Teacher Conductor</h1></div>
<div class="content" id="content"><p style="color:#9ca3af">Loading sequences...</p></div>
<script>
var TOKEN='${token}',currentSeq=null,currentIdx=0;
function load(){
  fetch('/sequences?token='+TOKEN).then(function(r){return r.json()}).then(function(d){
    if(!d.sequences||!d.sequences.length){document.getElementById('content').innerHTML='<p style="color:#9ca3af;padding:40px;text-align:center">No published sequences</p>';return;}
    var h='<h2 style="margin-bottom:12px">Select a Sequence</h2>';
    d.sequences.forEach(function(s){
      h+='<div class="item" onclick="selectSeq(\\''+s.id+'\\')"><div class="item-num">&#9654;</div><div><div style="font-weight:500;font-size:14px">'+s.name+'</div><div style="font-size:11px;color:#9ca3af">'+(s.items?s.items.length:0)+' items</div></div></div>';
    });
    document.getElementById('content').innerHTML=h;
  });
}
window.selectSeq=function(id){
  fetch('/sequences/'+id+'?token='+TOKEN).then(function(r){return r.json()}).then(function(s){
    currentSeq=s;currentIdx=0;renderConductor();
  });
};
function renderConductor(){
  var items=currentSeq.items||[];
  var h='<h2>'+currentSeq.name+'</h2><div class="controls"><button class="btn" onclick="goPrev()">&#9664; Previous</button><button class="btn" onclick="goNext()">Next &#9654;</button><button class="btn btn-outline" onclick="endSession()">End Session</button><button class="btn btn-outline" onclick="load()">Back</button></div>';
  h+='<div class="item-list">';
  items.forEach(function(it,i){
    h+='<div class="item'+(i===currentIdx?' active':'')+'" onclick="goTo('+i+')"><div class="item-num">'+(i+1)+'</div><div><div style="font-weight:500;font-size:13px">'+it.title+'</div><div style="font-size:11px;color:#9ca3af">'+it.item_type+'</div></div></div>';
  });
  h+='</div>';
  if(items[currentIdx]){
    var cur=items[currentIdx];
    h+='<div style="margin-top:16px;padding:16px;background:#1e2130;border:1px solid #6366f1;border-radius:8px"><div style="font-size:12px;color:#9ca3af">Now showing:</div><div style="font-size:16px;font-weight:600;margin-top:4px">'+cur.title+'</div><div style="font-size:12px;color:#9ca3af;margin-top:4px">Type: '+cur.item_type+'</div></div>';
  }
  document.getElementById('content').innerHTML=h;
}
function pushState(){
  fetch('/conductor/update',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({token:TOKEN,classroom_id:currentSeq.classroom_id||'default',sequence_id:currentSeq.id,current_item_index:currentIdx,status:'active'})}).catch(function(){});
}
window.goNext=function(){if(currentSeq&&currentIdx<(currentSeq.items||[]).length-1){currentIdx++;pushState();renderConductor();}};
window.goPrev=function(){if(currentIdx>0){currentIdx--;pushState();renderConductor();}};
window.goTo=function(i){currentIdx=i;pushState();renderConductor();};
window.endSession=function(){
  fetch('/conductor/end',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({token:TOKEN,classroom_id:currentSeq.classroom_id||'default'})}).then(function(){load()}).catch(function(){});
};
load();
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

// ── Error page helper ──
function errorPage(message: string): string {
  return `<!DOCTYPE html><html><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Pulse</title>
<style>body{font-family:sans-serif;background:#0f1117;color:#e5e7eb;display:flex;justify-content:center;align-items:center;min-height:100vh;margin:0}
.card{background:#1e2130;border:1px solid #374151;border-radius:12px;padding:40px;max-width:400px;text-align:center}
h1{color:#ef4444;margin-bottom:12px;font-size:20px}p{color:#9ca3af;font-size:14px}
</style></head><body><div class="card"><h1>Enrollment Error</h1><p>${message}</p></div></body></html>`;
}

// ── Start ──
async function main() {
  try {
    initDb();
  } catch (err: any) {
    log('warning', 'Local DB not available — running without persistence', { error: err.message });
  }

  app.listen(PORT, () => {
    log('info', `Node Agent listening on port ${PORT}`);
  });

  // Start heartbeat + update manager
  setInterval(sendHeartbeat, HEARTBEAT_INTERVAL_MS);
  sendHeartbeat();
  startUpdateManager();
  startAutoBackup();

  // Cleanup expired student sessions every hour
  setInterval(() => { try { cleanupExpiredSessions(); } catch (e: any) { log('warning', 'Session cleanup failed', { error: e.message }); } }, 60 * 60 * 1000);
}

main();
