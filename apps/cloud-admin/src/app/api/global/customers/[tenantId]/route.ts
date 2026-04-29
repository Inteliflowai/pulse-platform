import { NextRequest, NextResponse } from 'next/server';
import { createAdminSupabaseClient } from '@/lib/supabase/admin';
import { requireSuperAdmin } from '@/lib/require-super-admin';

/**
 * GET /api/global/customers/[tenantId]
 * Super-admin customer detail view: sites, nodes, users, licenses,
 * recent audit activity. Used by the /dashboard/global/customers/[id] page.
 */
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ tenantId: string }> },
) {
  const auth = await requireSuperAdmin();
  if (!auth.ok) return auth.response;

  const { tenantId } = await params;
  const supabase = createAdminSupabaseClient();

  const [tenantQ, sitesQ, nodesQ, usersQ, licensesQ, auditQ, credsQ] = await Promise.all([
    supabase.from('tenants').select('*').eq('id', tenantId).single(),
    supabase.from('sites').select('id, name, slug, status, created_at').eq('tenant_id', tenantId).order('name'),
    supabase.from('nodes').select('id, name, site_id, status, version, last_seen_at, storage_used_gb, storage_total_gb, metadata').eq('tenant_id', tenantId).order('name'),
    supabase.from('users').select('id, email, full_name, role, site_id, created_at').eq('tenant_id', tenantId).order('role'),
    supabase.from('product_licenses').select('*').eq('tenant_id', tenantId).order('product'),
    supabase.from('audit_logs').select('id, event_type, description, created_at, user_id').eq('tenant_id', tenantId).order('created_at', { ascending: false }).limit(20),
    supabase.from('tenant_integration_credentials').select('service, status, api_url, created_at, updated_at, api_key').eq('tenant_id', tenantId),
  ]);

  if (!tenantQ.data) {
    return NextResponse.json({ error: 'Customer not found' }, { status: 404 });
  }

  // Build per-service integration health snapshot. Don't return raw api_key
  // to the browser — the credential is sensitive. Just the prefix proves
  // "yes, a key exists" without exposing it.
  const integrations: Record<string, any> = {};
  for (const c of credsQ.data ?? []) {
    integrations[c.service] = {
      status: c.status,
      api_url: c.api_url,
      key_preview: c.api_key ? `${c.api_key.slice(0, 8)}…` : null,
      created_at: c.created_at,
      updated_at: c.updated_at,
    };
  }

  return NextResponse.json({
    tenant: tenantQ.data,
    sites: sitesQ.data ?? [],
    nodes: nodesQ.data ?? [],
    users: usersQ.data ?? [],
    licenses: licensesQ.data ?? [],
    recent_activity: auditQ.data ?? [],
    integrations,
  });
}
