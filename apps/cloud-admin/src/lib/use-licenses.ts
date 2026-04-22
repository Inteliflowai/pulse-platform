'use client';

import { useEffect, useState } from 'react';
import type { LicenseState, Product } from '@/lib/licenses';

export interface TenantLicense {
  product: Product;
  plan: string;
  seats: number;
  starts_at: string;
  expires_at: string | null;
  state: LicenseState;
}

export interface UseLicensesResult {
  licenses: TenantLicense[];
  loading: boolean;
  /** Quick lookup — returns 'missing' for products with no row at all. */
  state: (product: Product) => LicenseState;
  /** True when product is 'active' or 'trial'. The single value most UIs care about. */
  usable: (product: Product) => boolean;
}

/**
 * Load the caller's tenant's licenses and expose convenience lookups.
 *
 * Use at the top of any page that should hide or disable product-specific
 * UI (CORE integrations, SPARK assets, LIFT links) when the tenant isn't
 * licensed. The hook keeps the result in component state so the UI updates
 * once the fetch resolves — during `loading === true`, treat unknown
 * products as NOT usable to avoid flashing restricted UI.
 */
export function useLicenses(): UseLicensesResult {
  const [licenses, setLicenses] = useState<TenantLicense[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch('/api/licenses/mine');
        if (!res.ok) { if (!cancelled) setLoading(false); return; }
        const data = await res.json();
        if (!cancelled) {
          setLicenses(data.licenses ?? []);
          setLoading(false);
        }
      } catch {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, []);

  function state(product: Product): LicenseState {
    const row = licenses.find((l) => l.product === product);
    return row ? row.state : 'missing';
  }

  function usable(product: Product): boolean {
    const s = state(product);
    return s === 'active' || s === 'trial';
  }

  return { licenses, loading, state, usable };
}
