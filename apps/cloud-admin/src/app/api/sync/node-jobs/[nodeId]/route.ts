import { NextRequest, NextResponse } from 'next/server';
import { createAdminSupabaseClient } from '@/lib/supabase/admin';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ nodeId: string }> }
) {
  const { nodeId } = await params;
  const supabase = createAdminSupabaseClient();

  // Node auth: the node must present its own X-Node-Token matching nodes.registration_token.
  // The token alone is not trusted to identify the node — it must also match the URL nodeId.
  const nodeToken = request.headers.get('x-node-token');
  if (!nodeToken) {
    return NextResponse.json({ error: 'Missing X-Node-Token' }, { status: 401 });
  }

  const { data: node } = await supabase
    .from('nodes')
    .select('id, tenant_id')
    .eq('id', nodeId)
    .eq('registration_token', nodeToken)
    .eq('status', 'active')
    .single();

  if (!node) {
    // Same 401 for "wrong token" and "unknown node" — don't leak node existence.
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  // Fetch pending and in_progress jobs with package manifest, scoped to this node's tenant.
  const { data: jobs, error } = await supabase
    .from('sync_jobs')
    .select('*, packages(id, name, version, manifest, tenant_id)')
    .eq('node_id', nodeId)
    .eq('tenant_id', node.tenant_id)
    .in('status', ['pending', 'in_progress'])
    .order('created_at', { ascending: true });

  if (error) {
    return NextResponse.json({ error: 'Failed to fetch jobs' }, { status: 500 });
  }

  return NextResponse.json({ jobs: jobs ?? [] });
}
