import { NextRequest, NextResponse } from 'next/server';
import { createAdminSupabaseClient } from '@/lib/supabase/admin';
import { isCronAuthorized } from '@/lib/cron-auth';
import { writeAuditLog } from '@/lib/audit';

/**
 * GET /api/cron/expire-licenses
 * Flips any active/trial license whose expires_at is in the past to
 * status='expired'. Suspended rows are left alone (they were manually
 * revoked). Writes an audit_logs row per tenant so renewals are visible.
 *
 * Meant to be called daily by Vercel Cron or an external scheduler —
 * idempotent, safe to run more often.
 */
export async function GET(request: NextRequest) {
  if (!isCronAuthorized(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const supabase = createAdminSupabaseClient();
  const now = new Date().toISOString();

  const { data: stale } = await supabase
    .from('product_licenses')
    .select('id, tenant_id, product, status, expires_at')
    .in('status', ['active', 'trial'])
    .lt('expires_at', now)
    .not('expires_at', 'is', null);

  const rows = stale ?? [];
  let expired = 0;

  for (const row of rows) {
    const { error } = await supabase
      .from('product_licenses')
      .update({ status: 'expired' })
      .eq('id', row.id);
    if (error) continue;

    await writeAuditLog(supabase, {
      tenant_id: row.tenant_id,
      event_type: 'license_expired',
      entity_type: 'product_license',
      entity_id: row.id,
      description: `${row.product} license expired (was ${row.status})`,
      metadata: { product: row.product, prior_status: row.status, expired_at: row.expires_at },
    });

    expired++;
  }

  return NextResponse.json({ checked: rows.length, expired });
}
