/**
 * CORE integration smoke test.
 *
 * Exercises the three contract endpoints Pulse calls on CORE:
 *   1. POST {CORE}/api/admin/platform-keys           (cloud → CORE, provisioning secret)
 *   2. GET  {CORE}/api/attempts/pulse/export-classes  (cloud → CORE, per-tenant Bearer)
 *   3. POST {CORE}/api/attempts/pulse-lesson-complete (node  → CORE, per-tenant Bearer)
 *
 * Usage:
 *   npx tsx scripts/smoke-core.ts                    # dry-run, prints what it would call
 *   npx tsx scripts/smoke-core.ts --live             # actually fire the requests
 *   npx tsx scripts/smoke-core.ts --live --skip 1    # skip step 1 (provisioning)
 *
 * Required env (live mode):
 *   CORE_API_URL                base URL for CORE (default: https://app.inteliflowai.com)
 *   CORE_PROVISIONING_SECRET    platform-wide secret for step 1
 *   CORE_BEARER_KEY             per-tenant Bearer key for steps 2 + 3
 *   SMOKE_SCHOOL_ID             tenant_id to provision against (step 1)
 *   SMOKE_SCHOOL_NAME           human name for the provisioning request
 *   SMOKE_CORE_CLASS_ID         a CORE class id to use in step 3 (or empty)
 *   SMOKE_ASSET_ID              a Pulse asset_id to send in step 3
 *
 * Exit code: 0 if all probed steps pass, 1 if any fail.
 */

const argv = process.argv.slice(2);
const live = argv.includes('--live');
const skip = new Set(
  argv
    .map((a, i) => (a === '--skip' ? argv[i + 1] : null))
    .filter((x): x is string => Boolean(x))
    .flatMap((s) => s.split(',')),
);

const env = {
  CORE_API_URL: process.env.CORE_API_URL ?? 'https://app.inteliflowai.com',
  CORE_PROVISIONING_SECRET: process.env.CORE_PROVISIONING_SECRET ?? '',
  CORE_BEARER_KEY: process.env.CORE_BEARER_KEY ?? '',
  SMOKE_SCHOOL_ID: process.env.SMOKE_SCHOOL_ID ?? '',
  SMOKE_SCHOOL_NAME: process.env.SMOKE_SCHOOL_NAME ?? 'Smoke Test School',
  SMOKE_CORE_CLASS_ID: process.env.SMOKE_CORE_CLASS_ID ?? '',
  SMOKE_ASSET_ID: process.env.SMOKE_ASSET_ID ?? '00000000-0000-0000-0000-000000000000',
};

type StepResult = { name: string; ok: boolean; status?: number; latency_ms?: number; error?: string; preview?: any };

async function step(name: string, fn: () => Promise<StepResult>): Promise<StepResult> {
  const start = Date.now();
  try {
    const result = await fn();
    return { ...result, latency_ms: result.latency_ms ?? Date.now() - start };
  } catch (err: any) {
    return { name, ok: false, error: err.message ?? String(err), latency_ms: Date.now() - start };
  }
}

async function provision(): Promise<StepResult> {
  if (!live) return { name: 'provision', ok: true, preview: { note: 'dry-run, would POST /api/admin/platform-keys' } };
  if (!env.CORE_PROVISIONING_SECRET) return { name: 'provision', ok: false, error: 'CORE_PROVISIONING_SECRET not set' };
  if (!env.SMOKE_SCHOOL_ID) return { name: 'provision', ok: false, error: 'SMOKE_SCHOOL_ID not set' };

  const res = await fetch(`${env.CORE_API_URL}/api/admin/platform-keys`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'X-Provisioning-Secret': env.CORE_PROVISIONING_SECRET },
    body: JSON.stringify({ school_id: env.SMOKE_SCHOOL_ID, school_name: env.SMOKE_SCHOOL_NAME }),
    signal: AbortSignal.timeout(10_000),
  });
  const body = await res.json().catch(() => ({}));
  return { name: 'provision', ok: res.ok, status: res.status, preview: body };
}

async function exportClasses(): Promise<StepResult> {
  if (!live) return { name: 'export-classes', ok: true, preview: { note: 'dry-run, would GET /api/attempts/pulse/export-classes' } };
  if (!env.CORE_BEARER_KEY) return { name: 'export-classes', ok: false, error: 'CORE_BEARER_KEY not set' };

  const res = await fetch(`${env.CORE_API_URL}/api/attempts/pulse/export-classes`, {
    headers: { Authorization: `Bearer ${env.CORE_BEARER_KEY}` },
    signal: AbortSignal.timeout(10_000),
  });
  const body = await res.json().catch(() => ({}));
  const classCount = Array.isArray(body) ? body.length : Array.isArray(body.classes) ? body.classes.length : 0;
  return { name: 'export-classes', ok: res.ok, status: res.status, preview: { class_count: classCount, sample: classCount > 0 ? (body.classes ?? body)[0]?.name : null } };
}

async function lessonComplete(): Promise<StepResult> {
  if (!live) return { name: 'lesson-complete', ok: true, preview: { note: 'dry-run, would POST /api/attempts/pulse-lesson-complete' } };
  if (!env.CORE_BEARER_KEY) return { name: 'lesson-complete', ok: false, error: 'CORE_BEARER_KEY not set' };

  const res = await fetch(`${env.CORE_API_URL}/api/attempts/pulse-lesson-complete`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${env.CORE_BEARER_KEY}` },
    body: JSON.stringify({
      node_id: 'smoke-node-id',
      classroom_id: 'smoke-classroom-id',
      core_class_id: env.SMOKE_CORE_CLASS_ID || null,
      asset_id: env.SMOKE_ASSET_ID,
      sequence_id: null,
      sequence_item_index: null,
      student_id: null,
      device_id: 'smoke-device-id',
      watch_pct: 0.95,
      watch_duration_seconds: 600,
      delivery_mode: 'pulse_stb',
      completed_at: new Date().toISOString(),
    }),
    signal: AbortSignal.timeout(10_000),
  });
  const body = await res.json().catch(() => ({}));
  return { name: 'lesson-complete', ok: res.ok, status: res.status, preview: body };
}

async function main() {
  const mode = live ? 'LIVE' : 'DRY-RUN';
  console.log(`\nCORE smoke test — ${mode}`);
  console.log(`  Target: ${env.CORE_API_URL}`);
  console.log('');

  const steps = [
    { id: '1', label: 'provision (POST /api/admin/platform-keys)', fn: provision },
    { id: '2', label: 'export-classes (GET /api/attempts/pulse/export-classes)', fn: exportClasses },
    { id: '3', label: 'lesson-complete (POST /api/attempts/pulse-lesson-complete)', fn: lessonComplete },
  ];

  const results: StepResult[] = [];
  for (const s of steps) {
    if (skip.has(s.id)) {
      console.log(`  [${s.id}] ${s.label} — SKIPPED`);
      continue;
    }
    const r = await step(s.label, s.fn);
    results.push(r);
    const tag = r.ok ? '✓' : '✗';
    const status = r.status ? ` (HTTP ${r.status})` : '';
    const time = r.latency_ms !== undefined ? ` ${r.latency_ms}ms` : '';
    console.log(`  [${s.id}] ${tag} ${s.label}${status}${time}`);
    if (r.error) console.log(`         error: ${r.error}`);
    if (r.preview && Object.keys(r.preview).length > 0) {
      console.log(`         preview: ${JSON.stringify(r.preview).slice(0, 200)}`);
    }
  }

  const failed = results.filter((r) => !r.ok);
  console.log(`\n${failed.length === 0 ? 'All probes passed.' : `${failed.length} probe(s) failed.`}\n`);
  process.exit(failed.length === 0 ? 0 : 1);
}

main();
