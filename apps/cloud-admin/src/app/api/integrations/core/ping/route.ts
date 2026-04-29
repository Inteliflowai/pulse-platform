import { NextRequest, NextResponse } from 'next/server';
import { createAdminSupabaseClient } from '@/lib/supabase/admin';
import { requireSuperAdmin } from '@/lib/require-super-admin';

const CORE_API_URL_DEFAULT = process.env.CORE_API_URL ?? 'https://app.inteliflowai.com';

/**
 * POST /api/integrations/core/ping
 * Body: { tenant_id }
 *
 * Super-admin probe: resolves the per-tenant CORE Bearer key, hits CORE's
 * export-classes endpoint with it, and reports whether the credential is
 * actually accepted by CORE. Used by the customer detail page health card.
 */
export async function POST(request: NextRequest) {
  const auth = await requireSuperAdmin();
  if (!auth.ok) return auth.response;

  let tenantId: string;
  try {
    const body = await request.json();
    tenantId = body.tenant_id;
    if (!tenantId) throw new Error();
  } catch {
    return NextResponse.json({ error: 'Missing tenant_id' }, { status: 400 });
  }

  const supabase = createAdminSupabaseClient();
  const { data: cred } = await supabase
    .from('tenant_integration_credentials')
    .select('api_key, api_url, status')
    .eq('tenant_id', tenantId)
    .eq('service', 'core')
    .maybeSingle();

  if (!cred?.api_key) {
    return NextResponse.json({ ok: false, reason: 'no_credential' }, { status: 200 });
  }
  if (cred.status !== 'active') {
    return NextResponse.json({ ok: false, reason: 'credential_inactive', status: cred.status }, { status: 200 });
  }

  const url = `${cred.api_url || CORE_API_URL_DEFAULT}/api/attempts/pulse/export-classes`;
  const start = Date.now();
  try {
    const res = await fetch(url, {
      method: 'GET',
      headers: { Authorization: `Bearer ${cred.api_key}` },
      signal: AbortSignal.timeout(5_000),
    });
    const latency_ms = Date.now() - start;

    if (res.status === 401 || res.status === 403) {
      return NextResponse.json({ ok: false, reason: 'unauthorized', http_status: res.status, latency_ms });
    }
    if (!res.ok) {
      return NextResponse.json({ ok: false, reason: 'core_error', http_status: res.status, latency_ms });
    }
    return NextResponse.json({ ok: true, http_status: res.status, latency_ms });
  } catch (err: any) {
    return NextResponse.json({
      ok: false,
      reason: 'unreachable',
      error: err.message ?? 'Network error',
      latency_ms: Date.now() - start,
    });
  }
}
