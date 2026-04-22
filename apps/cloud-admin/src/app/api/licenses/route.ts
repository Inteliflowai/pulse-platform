import { NextRequest, NextResponse } from 'next/server';
import { createAdminSupabaseClient } from '@/lib/supabase/admin';
import { requireSuperAdmin } from '@/lib/require-super-admin';
import { writeAuditLog } from '@/lib/audit';
import { provisionPulseKey, deletePulseKey, listPulseKeys } from '@/lib/core-provisioning';

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

  // For CORE (and eventually SPARK/LIFT), also provision a per-tenant
  // Bearer credential with the provider. This is idempotent: a repeated
  // provision with an existing active credential returns the stored row
  // as-is; a 409 from CORE triggers the rotation path (delete + re-create).
  let credential: { status: string; reason?: string } | null = null;
  if (product === 'core') {
    credential = await provisionCoreCredentialForTenant(supabase, {
      tenant_id,
      tenant_name: tenant.name,
      actor_id: auth.userId,
      ip: request.headers.get('x-forwarded-for') ?? null,
      label: notes ?? null,
    });
  }

  return NextResponse.json({ license, credential }, { status: 201 });
}

// ── CORE credential provisioning ─────────────────────────────────

async function provisionCoreCredentialForTenant(
  supabase: ReturnType<typeof createAdminSupabaseClient>,
  params: {
    tenant_id: string;
    tenant_name: string;
    actor_id: string;
    ip: string | null;
    label: string | null;
  },
): Promise<{ status: string; reason?: string }> {
  const { tenant_id, tenant_name, actor_id, ip, label } = params;

  // Look up the acting super_admin's email to attribute the CORE audit entry.
  const { data: actor } = await supabase.from('users').select('email').eq('id', actor_id).single();
  const operatorEmail = actor?.email ?? null;

  // If there's already an active credential for this tenant+service, the
  // license re-provision is a no-op for credentials — don't churn keys.
  const { data: existing } = await supabase
    .from('tenant_integration_credentials')
    .select('id, status, provider_row_id, api_key')
    .eq('tenant_id', tenant_id)
    .eq('service', 'core')
    .maybeSingle();

  if (existing?.status === 'active' && existing?.api_key) {
    return { status: 'active' };
  }

  // First attempt: POST to CORE.
  let result = await provisionPulseKey({
    school_id: tenant_id,
    product: 'pulse',
    label: label ?? `${tenant_name} — auto-provisioned`,
    operator_email: operatorEmail,
  });

  // 409 from CORE means the (school_id, product) pair already has a row
  // there but Pulse lost it. Follow CORE's rotation pattern: list → delete → retry.
  if (!result.ok && !result.unavailable && result.status === 409) {
    const listed = await listPulseKeys(tenant_id, 'pulse');
    if (listed.ok && listed.keys.length > 0) {
      for (const row of listed.keys) {
        await deletePulseKey(row.id, operatorEmail);
      }
      result = await provisionPulseKey({
        school_id: tenant_id,
        product: 'pulse',
        label: label ?? `${tenant_name} — re-provisioned`,
        operator_email: operatorEmail,
      });
    }
  }

  if (result.ok) {
    await supabase
      .from('tenant_integration_credentials')
      .upsert(
        {
          tenant_id,
          service: 'core',
          api_key: result.key.api_key,
          provider_row_id: result.key.id,
          status: 'active',
          label: result.key.label,
          created_by: actor_id,
          revoked_at: null,
          revoked_by: null,
          last_error: null,
        },
        { onConflict: 'tenant_id,service' },
      );

    await writeAuditLog(supabase, {
      tenant_id,
      user_id: actor_id,
      event_type: existing ? 'license_credential_rotated' : 'license_credential_provisioned',
      entity_type: 'tenant_integration_credentials',
      entity_id: null,
      description: `${existing ? 'Rotated' : 'Provisioned'} CORE Bearer key for "${tenant_name}"`,
      ip_address: ip,
      metadata: { service: 'core', provider_row_id: result.key.id },
    });
    return { status: 'active' };
  }

  // Soft-failure path: CORE isn't configured (missing provisioning secret)
  // or was unreachable. Store a placeholder row so the UI can show "not
  // provisioned" with a retry button; license remains active so the customer
  // can start using Pulse-only features while Inteliflow ops fixes the secret.
  const reason = result.unavailable
    ? result.reason
    : `CORE responded ${result.status}: ${result.message}`;

  await supabase
    .from('tenant_integration_credentials')
    .upsert(
      {
        tenant_id,
        service: 'core',
        api_key: null,
        provider_row_id: null,
        status: 'not_provisioned',
        label: label ?? null,
        created_by: actor_id,
        last_error: reason,
      },
      { onConflict: 'tenant_id,service' },
    );

  await writeAuditLog(supabase, {
    tenant_id,
    user_id: actor_id,
    event_type: 'license_credential_provision_failed',
    entity_type: 'tenant_integration_credentials',
    entity_id: null,
    description: `CORE credential provisioning deferred for "${tenant_name}": ${reason}`,
    ip_address: ip,
    metadata: { service: 'core', reason },
  });

  return { status: 'not_provisioned', reason };
}
