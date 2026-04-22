import { NextRequest, NextResponse } from 'next/server';
import { createAdminSupabaseClient } from '@/lib/supabase/admin';
import { requireSuperAdmin } from '@/lib/require-super-admin';
import { writeAuditLog } from '@/lib/audit';

const VALID_PRODUCTS = ['pulse', 'spark', 'core', 'lift'] as const;
const VALID_PLANS = ['trial', 'starter', 'professional', 'enterprise'] as const;
const VALID_STATUSES = ['active', 'expired', 'suspended', 'trial'] as const;

/**
 * GET /api/licenses
 * List all product licenses across all tenants, joined with tenant name.
 * Super admin only — this is the cross-customer license inventory.
 */
export async function GET(request: NextRequest) {
  const auth = await requireSuperAdmin();
  if (!auth.ok) return auth.response;

  const url = new URL(request.url);
  const productFilter = url.searchParams.get('product');
  const statusFilter = url.searchParams.get('status');

  const supabase = createAdminSupabaseClient();
  let q = supabase
    .from('product_licenses')
    .select('*, tenants(id, name, slug)')
    .order('created_at', { ascending: false });

  if (productFilter) q = q.eq('product', productFilter);
  if (statusFilter) q = q.eq('status', statusFilter);

  const { data, error } = await q;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ licenses: data ?? [] });
}

/**
 * POST /api/licenses
 * Provision a license for a tenant. Upserts on (tenant_id, product) — calling
 * this twice for the same pair is a renewal/extension, not a duplicate.
 * Body: { tenant_id, product, plan?, seats?, expires_at?, status?, notes? }
 */
export async function POST(request: NextRequest) {
  const auth = await requireSuperAdmin();
  if (!auth.ok) return auth.response;

  let body: any;
  try { body = await request.json(); } catch { return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 }); }

  const { tenant_id, product, plan, seats, expires_at, status, notes } = body ?? {};

  if (!tenant_id || !product) {
    return NextResponse.json({ error: 'tenant_id and product are required' }, { status: 400 });
  }
  if (!VALID_PRODUCTS.includes(product)) {
    return NextResponse.json({ error: `product must be one of ${VALID_PRODUCTS.join(', ')}` }, { status: 400 });
  }
  if (plan && !VALID_PLANS.includes(plan)) {
    return NextResponse.json({ error: `plan must be one of ${VALID_PLANS.join(', ')}` }, { status: 400 });
  }
  if (status && !VALID_STATUSES.includes(status)) {
    return NextResponse.json({ error: `status must be one of ${VALID_STATUSES.join(', ')}` }, { status: 400 });
  }

  const supabase = createAdminSupabaseClient();

  // Make sure the tenant actually exists before creating a license for it —
  // otherwise the FK error would be confusing in the audit trail.
  const { data: tenant } = await supabase.from('tenants').select('id, name').eq('id', tenant_id).single();
  if (!tenant) {
    return NextResponse.json({ error: 'Tenant not found' }, { status: 404 });
  }

  const { data: license, error } = await supabase
    .from('product_licenses')
    .upsert(
      {
        tenant_id,
        product,
        plan: plan ?? 'starter',
        seats: seats ?? 0,
        expires_at: expires_at ?? null,
        status: status ?? 'active',
        notes: notes ?? null,
        created_by: auth.userId,
      },
      { onConflict: 'tenant_id,product' },
    )
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  await writeAuditLog(supabase, {
    tenant_id,
    user_id: auth.userId,
    event_type: 'license_provisioned',
    entity_type: 'product_license',
    entity_id: license?.id ?? null,
    description: `Provisioned ${product} license (${plan ?? 'starter'}) for "${tenant.name}"`,
    ip_address: request.headers.get('x-forwarded-for') ?? null,
    metadata: { product, plan: plan ?? 'starter', seats: seats ?? 0, expires_at: expires_at ?? null },
  });

  return NextResponse.json({ license }, { status: 201 });
}
