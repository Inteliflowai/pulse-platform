import { NextRequest, NextResponse } from 'next/server';
import { createAdminSupabaseClient } from '@/lib/supabase/admin';
import { requireSuperAdmin } from '@/lib/require-super-admin';
import { writeAuditLog } from '@/lib/audit';

/**
 * GET /api/global/customers
 * List all tenants with summary counts (sites, nodes, users) and their
 * active product licenses. Super admin only — this is the Inteliflow
 * company-ops customer directory.
 */
export async function GET() {
  const auth = await requireSuperAdmin();
  if (!auth.ok) return auth.response;

  const supabase = createAdminSupabaseClient();

  // Pull everything in parallel, then compose client-side-style. With a small
  // tenant count this is fine; at 1000+ tenants we'd push aggregation to SQL.
  const [tenantsQ, sitesQ, nodesQ, usersQ, licensesQ] = await Promise.all([
    supabase.from('tenants').select('id, name, slug, status, created_at').order('created_at', { ascending: false }),
    supabase.from('sites').select('id, tenant_id'),
    supabase.from('nodes').select('id, tenant_id, status, last_seen_at'),
    supabase.from('users').select('id, tenant_id'),
    supabase.from('product_licenses').select('id, tenant_id, product, status, expires_at'),
  ]);

  const tenants = tenantsQ.data ?? [];
  const tallies: Record<string, { sites: number; nodes: number; nodes_online: number; users: number; licenses: string[] }> = {};
  for (const t of tenants) {
    tallies[t.id] = { sites: 0, nodes: 0, nodes_online: 0, users: 0, licenses: [] };
  }
  for (const s of (sitesQ.data ?? [])) if (tallies[s.tenant_id]) tallies[s.tenant_id].sites++;
  for (const n of (nodesQ.data ?? [])) {
    if (!tallies[n.tenant_id]) continue;
    tallies[n.tenant_id].nodes++;
    if (n.status === 'active') tallies[n.tenant_id].nodes_online++;
  }
  for (const u of (usersQ.data ?? [])) if (tallies[u.tenant_id]) tallies[u.tenant_id].users++;
  for (const l of (licensesQ.data ?? [])) {
    if (!tallies[l.tenant_id]) continue;
    // Only show an active/trial license as "licensed" in the summary view.
    const expired = l.expires_at && new Date(l.expires_at).getTime() < Date.now();
    if ((l.status === 'active' || l.status === 'trial') && !expired) {
      tallies[l.tenant_id].licenses.push(l.product);
    }
  }

  return NextResponse.json({
    customers: tenants.map((t) => ({
      ...t,
      ...tallies[t.id],
    })),
  });
}

/**
 * POST /api/global/customers
 * Create a new tenant (customer). Body: { name, slug?, initial_admin_email? }.
 * If initial_admin_email is provided, invites that user as tenant_admin.
 */
export async function POST(request: NextRequest) {
  const auth = await requireSuperAdmin();
  if (!auth.ok) return auth.response;

  let body: any;
  try { body = await request.json(); } catch { return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 }); }
  const { name, slug, initial_admin_email } = body ?? {};
  if (!name || typeof name !== 'string') {
    return NextResponse.json({ error: 'Missing or invalid name' }, { status: 400 });
  }

  const supabase = createAdminSupabaseClient();

  const tenantSlug = (slug && typeof slug === 'string' && slug.trim())
    ? slug.trim().toLowerCase()
    : name.trim().toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');

  const { data: tenant, error: tErr } = await supabase
    .from('tenants')
    .insert({ name: name.trim(), slug: tenantSlug, status: 'active' })
    .select('id, name, slug')
    .single();

  if (tErr || !tenant) {
    return NextResponse.json({ error: tErr?.message ?? 'Failed to create tenant' }, { status: 500 });
  }

  let invitedUserId: string | null = null;
  if (initial_admin_email && typeof initial_admin_email === 'string') {
    try {
      const { data: authData, error: authErr } = await supabase.auth.admin.createUser({
        email: initial_admin_email,
        email_confirm: false,
        user_metadata: { role: 'tenant_admin', tenant_id: tenant.id },
      });
      if (!authErr && authData?.user) {
        invitedUserId = authData.user.id;
        await supabase.from('users').insert({
          id: authData.user.id,
          tenant_id: tenant.id,
          email: initial_admin_email,
          role: 'tenant_admin',
        });
      }
    } catch {
      // Don't roll back the tenant if the invite fails — the super_admin
      // can retry the invite separately.
    }
  }

  await writeAuditLog(supabase, {
    tenant_id: tenant.id,
    user_id: auth.userId,
    event_type: 'customer_created',
    entity_type: 'tenant',
    entity_id: tenant.id,
    description: `Created customer "${tenant.name}"${invitedUserId ? ` with initial admin ${initial_admin_email}` : ''}`,
    ip_address: request.headers.get('x-forwarded-for') ?? null,
  });

  return NextResponse.json({ tenant, initial_admin_user_id: invitedUserId }, { status: 201 });
}
