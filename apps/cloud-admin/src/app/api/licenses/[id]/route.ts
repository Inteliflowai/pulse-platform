import { NextRequest, NextResponse } from 'next/server';
import { createAdminSupabaseClient } from '@/lib/supabase/admin';
import { requireSuperAdmin } from '@/lib/require-super-admin';
import { writeAuditLog } from '@/lib/audit';

/**
 * DELETE /api/licenses/[id]
 * Revoke a license. We soft-revoke by setting status = 'suspended' and
 * preserving the row for audit — hard-delete removes history and makes
 * billing reconciliation hard.
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const auth = await requireSuperAdmin();
  if (!auth.ok) return auth.response;

  const { id } = await params;
  const supabase = createAdminSupabaseClient();

  const { data: license } = await supabase
    .from('product_licenses')
    .select('id, tenant_id, product, tenants(name)')
    .eq('id', id)
    .single();

  if (!license) {
    return NextResponse.json({ error: 'License not found' }, { status: 404 });
  }

  const { error } = await supabase
    .from('product_licenses')
    .update({ status: 'suspended' })
    .eq('id', id);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  await writeAuditLog(supabase, {
    tenant_id: license.tenant_id,
    user_id: auth.userId,
    event_type: 'license_suspended',
    entity_type: 'product_license',
    entity_id: id,
    description: `Suspended ${license.product} license for "${(license as any).tenants?.name ?? 'unknown'}"`,
    ip_address: request.headers.get('x-forwarded-for') ?? null,
  });

  return NextResponse.json({ ok: true });
}
