/**
 * CORE provisioning client.
 *
 * Thin wrapper around CORE's admin endpoints for creating/listing/deleting
 * per-school Bearer keys. Called only by super_admin flows in Pulse cloud —
 * never by nodes, never by customer-side users.
 *
 * All calls require CORE_PROVISIONING_SECRET in the environment. When the
 * secret is absent, the helpers return { unavailable: true } so the caller
 * can record a "not provisioned" credential with a retry affordance in the
 * UI rather than failing the whole license operation.
 *
 * Spec: https://github.com/Inteliflowai/core/blob/main/docs/pulse-integration.md
 */

export type Product = 'pulse' | 'spark' | 'lift' | 'custom';

const DEFAULT_CORE_URL = 'https://app.inteliflowai.com';
const TIMEOUT_MS = 10_000;

function coreUrl(): string {
  return (process.env.CORE_API_URL || DEFAULT_CORE_URL).replace(/\/$/, '');
}

function provisioningSecret(): string | null {
  const s = process.env.CORE_PROVISIONING_SECRET;
  return s && s.length > 0 ? s : null;
}

/**
 * Build the standard headers for a CORE admin call. Includes X-Operator
 * when we know which super_admin triggered the action — CORE records it
 * in its audit_logs for attribution.
 */
function adminHeaders(operatorEmail?: string | null): Headers {
  const h = new Headers();
  h.set('Content-Type', 'application/json');
  const secret = provisioningSecret();
  if (secret) h.set('X-Provisioning-Secret', secret);
  if (operatorEmail) h.set('X-Operator', operatorEmail);
  return h;
}

export interface CoreKeyRow {
  id: string;            // CORE's platform_api_keys.id — needed for DELETE
  api_key: string;       // The Bearer token. Only returned on POST.
  product: Product;
  school_id: string;
  label: string | null;
  is_active: boolean;
  created_at: string;
}

export type ProvisionResult =
  | { ok: true; key: CoreKeyRow }
  | { ok: false; unavailable: true; reason: string }
  | { ok: false; unavailable: false; status: number; message: string };

/**
 * Create a per-school Bearer key on CORE. Lets CORE generate the api_key
 * (simpler; CORE's generator is cryptographically strong and it's what
 * their spec's quick-start documents).
 *
 * On 409, the caller should list → delete → retry (rotation path).
 */
export async function provisionPulseKey(params: {
  school_id: string;
  product?: Product;
  label?: string | null;
  operator_email?: string | null;
}): Promise<ProvisionResult> {
  if (!provisioningSecret()) {
    return { ok: false, unavailable: true, reason: 'CORE_PROVISIONING_SECRET is not set' };
  }

  try {
    const res = await fetch(`${coreUrl()}/api/admin/platform-keys`, {
      method: 'POST',
      headers: adminHeaders(params.operator_email),
      body: JSON.stringify({
        product: params.product ?? 'pulse',
        school_id: params.school_id,
        label: params.label ?? null,
      }),
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });

    const body = await safeJson(res);

    if (!res.ok) {
      return {
        ok: false,
        unavailable: false,
        status: res.status,
        message: extractError(body) ?? `CORE provisioning failed with HTTP ${res.status}`,
      };
    }

    const key = body as CoreKeyRow;
    return { ok: true, key };
  } catch (err: any) {
    return {
      ok: false,
      unavailable: true,
      reason: err?.message ?? 'CORE provisioning network error',
    };
  }
}

/**
 * Delete a per-school Bearer key from CORE. Uses the *row id* from the
 * CORE response, not the api_key itself.
 */
export async function deletePulseKey(providerRowId: string, operatorEmail?: string | null): Promise<
  | { ok: true }
  | { ok: false; unavailable: true; reason: string }
  | { ok: false; unavailable: false; status: number; message: string }
> {
  if (!provisioningSecret()) {
    return { ok: false, unavailable: true, reason: 'CORE_PROVISIONING_SECRET is not set' };
  }

  try {
    const res = await fetch(`${coreUrl()}/api/admin/platform-keys/${encodeURIComponent(providerRowId)}`, {
      method: 'DELETE',
      headers: adminHeaders(operatorEmail),
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });

    if (res.status === 404) {
      // Already gone — treat as success. Idempotent revocation.
      return { ok: true };
    }
    if (!res.ok) {
      const body = await safeJson(res);
      return {
        ok: false,
        unavailable: false,
        status: res.status,
        message: extractError(body) ?? `CORE revocation failed with HTTP ${res.status}`,
      };
    }
    return { ok: true };
  } catch (err: any) {
    return {
      ok: false,
      unavailable: true,
      reason: err?.message ?? 'CORE revocation network error',
    };
  }
}

/**
 * List keys for a specific school + product. Used during rotation to
 * discover the row id before deleting. Never returns the api_key column —
 * CORE strips it on list responses.
 */
export async function listPulseKeys(schoolId: string, product: Product = 'pulse'): Promise<
  | { ok: true; keys: Array<Omit<CoreKeyRow, 'api_key'> & { last_used_at: string | null }> }
  | { ok: false; unavailable: true; reason: string }
  | { ok: false; unavailable: false; status: number; message: string }
> {
  if (!provisioningSecret()) {
    return { ok: false, unavailable: true, reason: 'CORE_PROVISIONING_SECRET is not set' };
  }

  try {
    const url = new URL(`${coreUrl()}/api/admin/platform-keys`);
    url.searchParams.set('school_id', schoolId);
    url.searchParams.set('product', product);

    const res = await fetch(url.toString(), {
      method: 'GET',
      headers: adminHeaders(),
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });

    const body = await safeJson(res);
    if (!res.ok) {
      return {
        ok: false,
        unavailable: false,
        status: res.status,
        message: extractError(body) ?? `CORE list failed with HTTP ${res.status}`,
      };
    }
    return { ok: true, keys: (body as any)?.keys ?? [] };
  } catch (err: any) {
    return {
      ok: false,
      unavailable: true,
      reason: err?.message ?? 'CORE list network error',
    };
  }
}

async function safeJson(res: Response): Promise<unknown> {
  try { return await res.json(); } catch { return null; }
}

function extractError(body: unknown): string | null {
  if (!body || typeof body !== 'object') return null;
  const obj = body as Record<string, unknown>;
  if (typeof obj.error === 'string') return obj.error;
  if (typeof obj.message === 'string') return obj.message;
  return null;
}
