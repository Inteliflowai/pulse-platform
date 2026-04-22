import { NextRequest, NextResponse } from 'next/server';
import { createAdminSupabaseClient } from '@/lib/supabase/admin';
import { requireSuperAdmin } from '@/lib/require-super-admin';
import { writeAuditLog } from '@/lib/audit';
import { deletePulseKey } from '@/lib/core-provisioning';

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

  // If the suspended license corresponds to a service with a per-tenant
  // Bearer credential (currently just 'core'), revoke that credential too
  // so the tenant's next runtime call against CORE 401s cleanly.
  if (license.product === 'core') {
    const { data: cred } = await supabase
      .from('tenant_integration_credentials')
      .select('id, provider_row_id')
      .eq('tenant_id', license.tenant_id)
      .eq('service', 'core')
      .maybeSingle();

    if (cred?.provider_row_id) {
      const { data: actor } = await supabase.from('users').select('email').eq('id', auth.userId).single();
      const deletion = await deletePulseKey(cred.provider_row_id, actor?.email ?? null);

      // Regardless of CORE's response we locally mark revoked — a CORE
      // outage shouldn't leave Pulse thinking the credential is still live.
      await supabase
        .from('tenant_integration_credentials')
        .update({
          status: 'revoked',
          revoked_at: new Date().toISOString(),
          revoked_by: auth.userId,
          last_error: deletion.ok ? null : (
            deletion.unavailable
              ? `CORE revoke unavailable: ${deletion.reason}`
              : `CORE returned ${deletion.status}: ${deletion.message}`
          ),
        })
        .eq('id', cred.id);

      await writeAuditLog(supabase, {
        tenant_id: license.tenant_id,
        user_id: auth.userId,
        event_type: 'license_credential_revoked',
        entity_type: 'tenant_integration_credentials',
        entity_id: cred.id,
        description: `Revoked CORE Bearer key for "${(license as any).tenants?.name ?? 'unknown'}"`,
        ip_address: request.headers.get('x-forwarded-for') ?? null,
        metadata: { service: 'core', core_revoked: deletion.ok, provider_row_id: cred.provider_row_id },
      });
    }
  }

  return NextResponse.json({ ok: true });
}
