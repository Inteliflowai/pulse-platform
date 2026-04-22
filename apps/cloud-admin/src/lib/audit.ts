/**
 * Audit logging helper.
 *
 * Writes a row to `audit_logs`. Best-effort: failures are swallowed so the
 * caller's primary action is never blocked by the audit write — but failures
 * are logged via error-tracking so ops can notice drift.
 */

import type { SupabaseClient } from '@supabase/supabase-js';
import { trackError } from './error-tracking';

export interface AuditEntry {
  tenant_id: string;
  user_id?: string | null;
  node_id?: string | null;
  event_type: string;
  entity_type?: string | null;
  entity_id?: string | null;
  description?: string | null;
  ip_address?: string | null;
  metadata?: Record<string, unknown>;
}

export async function writeAuditLog(
  supabase: SupabaseClient,
  entry: AuditEntry,
): Promise<void> {
  try {
    const { error } = await supabase.from('audit_logs').insert({
      tenant_id: entry.tenant_id,
      user_id: entry.user_id ?? null,
      node_id: entry.node_id ?? null,
      event_type: entry.event_type,
      entity_type: entry.entity_type ?? null,
      entity_id: entry.entity_id ?? null,
      description: entry.description ?? null,
      ip_address: entry.ip_address ?? null,
      metadata: entry.metadata ?? {},
    });
    if (error) {
      trackError(error.message, { op: 'writeAuditLog', event_type: entry.event_type }, 'warning');
    }
  } catch (err: any) {
    trackError(err?.message ?? 'audit write failed', { op: 'writeAuditLog' }, 'warning');
  }
}
