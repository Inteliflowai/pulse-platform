/**
 * Node-to-cloud authentication helper.
 *
 * All node-facing endpoints (heartbeat, sync job status, config, events,
 * update checks, progress upload) must validate that the caller is a
 * registered, active node and that the node they claim to be in the
 * URL/body matches the token they present.
 *
 * Usage:
 *   const auth = await requireNodeToken(request);
 *   if (auth instanceof NextResponse) return auth;   // 401 short-circuit
 *   const { node } = auth;                           // { id, tenant_id, ... }
 *
 * Optionally pin the caller to a specific nodeId (from URL or body) so
 * a stolen token can't be used to act as a different node:
 *   const auth = await requireNodeToken(request, { expectedNodeId: nodeId });
 */

import { NextRequest, NextResponse } from 'next/server';
import { createAdminSupabaseClient } from '@/lib/supabase/admin';

export interface AuthorizedNode {
  id: string;
  tenant_id: string;
  site_id: string | null;
  status: string;
}

export interface RequireNodeTokenOptions {
  /**
   * If set, the authenticated node's id must equal this. Use for routes
   * that take a nodeId in the URL or body — prevents a valid token being
   * used to act as a different node.
   */
  expectedNodeId?: string | null;
}

export type NodeAuthResult =
  | { ok: true; node: AuthorizedNode }
  | { ok: false; response: NextResponse };

export async function requireNodeToken(
  request: NextRequest,
  opts: RequireNodeTokenOptions = {},
): Promise<NodeAuthResult> {
  const token = request.headers.get('x-node-token');
  if (!token) {
    return { ok: false, response: NextResponse.json({ error: 'Missing X-Node-Token' }, { status: 401 }) };
  }

  const supabase = createAdminSupabaseClient();
  const { data: node } = await supabase
    .from('nodes')
    .select('id, tenant_id, site_id, status, registration_token')
    .eq('registration_token', token)
    .single();

  if (!node || node.status !== 'active') {
    // Same 401 for "unknown token" and "inactive node" — don't leak which.
    return { ok: false, response: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }) };
  }

  if (opts.expectedNodeId && opts.expectedNodeId !== node.id) {
    return { ok: false, response: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }) };
  }

  return {
    ok: true,
    node: {
      id: node.id,
      tenant_id: node.tenant_id,
      site_id: node.site_id,
      status: node.status,
    },
  };
}
