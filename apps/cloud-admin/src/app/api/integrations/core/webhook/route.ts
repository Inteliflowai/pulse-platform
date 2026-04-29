import { NextRequest, NextResponse } from 'next/server';
import { timingSafeEqual } from 'node:crypto';
import { createAdminSupabaseClient } from '@/lib/supabase/admin';

/**
 * POST /api/integrations/core/webhook
 *
 * Inbound webhook receiver for CORE → Pulse events. Auth mirrors GET /api/videos:
 * X-Core-Secret header, timing-safe compare against CORE_API_SECRET. Same
 * platform-to-platform secret on both sides; distinct from the per-tenant
 * Bearer keys used on the runtime Pulse → CORE direction.
 *
 * Scaffold: this handler is generic. CORE has not yet specified an event
 * catalogue, so for now every accepted event is recorded in audit_logs and
 * returns 200. When CORE confirms specific event types (likely candidates:
 * quiz_completed, score_updated, roster_changed), add a handler in the
 * `handlers` map below — leave the generic audit-log path as a fallback.
 *
 * Expected request body (open contract):
 *   {
 *     event_type: string,           // e.g. "quiz_completed"
 *     occurred_at: ISO 8601 string,
 *     tenant_id: string,            // Pulse tenant_id (= CORE school_id)
 *     payload: object,              // event-specific
 *   }
 */

function authorized(request: NextRequest): boolean {
  const secret = process.env.CORE_API_SECRET;
  if (!secret) return false;
  const provided = request.headers.get('x-core-secret');
  if (!provided) return false;
  const a = Buffer.from(provided);
  const b = Buffer.from(secret);
  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}

type WebhookHandler = (
  payload: any,
  ctx: { tenant_id: string; occurred_at: string; admin: ReturnType<typeof createAdminSupabaseClient> },
) => Promise<{ ok: boolean; note?: string }>;

const handlers: Record<string, WebhookHandler> = {
  // Add concrete handlers here as CORE confirms event types.
  // Example shape:
  // quiz_completed: async (payload, ctx) => { ... return { ok: true }; },
};

export async function POST(request: NextRequest) {
  if (!authorized(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  let body: any;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  const event_type = body?.event_type;
  const tenant_id = body?.tenant_id;
  const occurred_at = body?.occurred_at ?? new Date().toISOString();
  const payload = body?.payload ?? {};

  if (!event_type || !tenant_id) {
    return NextResponse.json({ error: 'event_type and tenant_id are required' }, { status: 400 });
  }

  const admin = createAdminSupabaseClient();

  // Always record the event for visibility, even if we don't have a handler yet.
  try {
    await admin
      .from('audit_logs')
      .insert({
        tenant_id,
        event_type: `core_webhook.${event_type}`,
        description: `CORE webhook received: ${event_type}`,
        metadata: { payload, occurred_at, source: 'core' },
      });
  } catch {
    // Audit failure shouldn't fail the webhook — CORE has no use for our retry.
  }

  const handler = handlers[event_type];
  if (!handler) {
    // No-op accept — CORE shouldn't retry on a 200, and we have a record.
    return NextResponse.json({ ok: true, handled: false, note: 'event_type recognized but no handler installed' });
  }

  try {
    const result = await handler(payload, { tenant_id, occurred_at, admin });
    return NextResponse.json({ ok: result.ok, handled: true, note: result.note });
  } catch (err: any) {
    return NextResponse.json({ ok: false, handled: false, error: err.message ?? 'Handler failed' }, { status: 500 });
  }
}
