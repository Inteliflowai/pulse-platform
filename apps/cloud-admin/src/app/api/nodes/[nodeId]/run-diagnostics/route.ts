import { NextRequest, NextResponse } from 'next/server';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { createAdminSupabaseClient } from '@/lib/supabase/admin';

/**
 * POST /api/nodes/[nodeId]/run-diagnostics
 * Proxies diagnostics collection request to the node agent.
 */
export async function POST(
  _request: NextRequest,
  { params }: { params: Promise<{ nodeId: string }> }
) {
  const { nodeId } = await params;

  const supabase = await createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  // Verify sysadmin role
  const { data: profile } = await supabase
    .from('users')
    .select('role')
    .eq('id', user.id)
    .single();
  if (!profile || !['super_admin', 'tenant_admin', 'site_admin'].includes(profile.role)) {
    return NextResponse.json({ error: 'Insufficient permissions' }, { status: 403 });
  }

  const admin = createAdminSupabaseClient();
  const { data: node } = await admin
    .from('nodes')
    .select('ip_address, registration_token')
    .eq('id', nodeId)
    .single();

  if (!node || !node.ip_address) {
    return NextResponse.json({ error: 'Node not found or no IP address' }, { status: 404 });
  }

  try {
    const nodeUrl = `http://${node.ip_address}:3100/diagnostics/collect`;
    const res = await fetch(nodeUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Node-Token': node.registration_token ?? '',
      },
      signal: AbortSignal.timeout(15_000),
    });

    if (!res.ok) {
      return NextResponse.json({ error: 'Node returned error', status: res.status }, { status: 502 });
    }

    const diagnostics = await res.json();

    // Server-side sanitization of logs (defense in depth)
    if (diagnostics.recent_errors && Array.isArray(diagnostics.recent_errors)) {
      const sensitivePattern = /token|secret|key|password|credential/i;
      diagnostics.recent_errors = diagnostics.recent_errors.filter(
        (line: string) => !sensitivePattern.test(line)
      );
    }

    return NextResponse.json({ diagnostics });
  } catch (err: any) {
    return NextResponse.json({ error: 'node_unreachable', message: err.message }, { status: 502 });
  }
}
