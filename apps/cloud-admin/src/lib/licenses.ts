/**
 * Product license helper.
 *
 * Call sites check whether a tenant is licensed for a given product
 * (SPARK, CORE, LIFT, or Pulse itself). This module does not enforce
 * anything on its own — feature routes opt in by calling hasLicense()
 * and deciding how to respond (refuse, degrade, show a CTA).
 *
 * Typical use in an API route:
 *
 *   const state = await hasLicense(supabase, tenantId, 'spark');
 *   if (state !== 'active') {
 *     return NextResponse.json({ error: 'SPARK not licensed' }, { status: 402 });
 *   }
 */

import type { SupabaseClient } from '@supabase/supabase-js';

export type Product = 'pulse' | 'spark' | 'core' | 'lift';
export type LicenseState = 'active' | 'expired' | 'suspended' | 'trial' | 'missing';

export interface LicenseRow {
  id: string;
  tenant_id: string;
  product: Product;
  plan: string;
  seats: number;
  starts_at: string;
  expires_at: string | null;
  status: LicenseState;
}

export async function getLicense(
  supabase: SupabaseClient,
  tenantId: string,
  product: Product,
): Promise<LicenseRow | null> {
  const { data } = await supabase
    .from('product_licenses')
    .select('id, tenant_id, product, plan, seats, starts_at, expires_at, status')
    .eq('tenant_id', tenantId)
    .eq('product', product)
    .maybeSingle();
  return (data as LicenseRow) ?? null;
}

/**
 * Collapses the stored status + expiry into a single verdict.
 *
 * 'missing' — no row at all; the tenant has never been provisioned.
 * 'expired' — row exists but expires_at is in the past.
 * 'suspended' — row exists with status = suspended (manual admin action).
 * 'trial'    — row exists with status = trial (and not expired).
 * 'active'   — row exists with status = active (and not expired).
 */
export async function hasLicense(
  supabase: SupabaseClient,
  tenantId: string,
  product: Product,
): Promise<LicenseState> {
  const row = await getLicense(supabase, tenantId, product);
  if (!row) return 'missing';
  return resolveLicenseState(row);
}

export function resolveLicenseState(row: Pick<LicenseRow, 'status' | 'expires_at'>): LicenseState {
  if (row.status === 'suspended') return 'suspended';
  if (row.expires_at && new Date(row.expires_at).getTime() < Date.now()) return 'expired';
  if (row.status === 'trial') return 'trial';
  if (row.status === 'active') return 'active';
  // Stored status is 'expired' or something else — respect it.
  return row.status as LicenseState;
}

export function isLicenseUsable(state: LicenseState): boolean {
  return state === 'active' || state === 'trial';
}
