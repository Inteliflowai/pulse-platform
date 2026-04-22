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

  const [tenantQ, sitesQ, nodesQ, usersQ, licensesQ, auditQ] = await Promise.all([
    supabase.from('tenants').select('*').eq('id', tenantId).single(),
    supabase.from('sites').select('id, name, slug, status, created_at').eq('tenant_id', tenantId).order('name'),
    supabase.from('nodes').select('id, name, site_id, status, version, last_seen_at, storage_used_gb, storage_total_gb').eq('tenant_id', tenantId).order('name'),
    supabase.from('users').select('id, email, full_name, role, site_id, created_at').eq('tenant_id', tenantId).order('role'),
    supabase.from('product_licenses').select('*').eq('tenant_id', tenantId).order('product'),
    supabase.from('audit_logs').select('id, event_type, description, created_at, user_id').eq('tenant_id', tenantId).order('created_at', { ascending: false }).limit(20),
  ]);

  if (!tenantQ.data) {
    return NextResponse.json({ error: 'Customer not found' }, { status: 404 });
  }

  return NextResponse.json({
    tenant: tenantQ.data,
    sites: sitesQ.data ?? [],
    nodes: nodesQ.data ?? [],
    users: usersQ.data ?? [],
    licenses: licensesQ.data ?? [],
    recent_activity: auditQ.data ?? [],
  });
}
