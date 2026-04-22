import { NextRequest, NextResponse } from 'next/server';
import { createAdminSupabaseClient } from '@/lib/supabase/admin';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { resolveLicenseState } from '@/lib/licenses';

/**
 * GET /api/licenses/mine
 * Returns the caller's tenant's product licenses, with the resolved state
 * (active/trial/expired/suspended/missing). UI uses this to show or hide
 * SPARK/CORE/LIFT sections without leaking other tenants' license data.
 *
 * Any authenticated user of the tenant can read — this is read-only visibility
 * into "what are we licensed for?", not the full admin license detail.
 */
export async function GET(_request: NextRequest) {
  const sb = await createSupabaseServerClient();
  const { data: { user } } = await sb.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { data: profile } = await sb.from('users').select('tenant_id').eq('id', user.id).single();
  if (!profile) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const admin = createAdminSupabaseClient();
  const { data: rows } = await admin
    .from('product_licenses')
    .select('product, plan, seats, starts_at, expires_at, status')
    .eq('tenant_id', profile.tenant_id);

  const licenses = (rows ?? []).map((r: any) => ({
    product: r.product,
    plan: r.plan,
    seats: r.seats,
    starts_at: r.starts_at,
    expires_at: r.expires_at,
    state: resolveLicenseState(r),
  }));

  return NextResponse.json({ tenant_id: profile.tenant_id, licenses });
}
