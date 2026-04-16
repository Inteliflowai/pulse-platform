import { NextRequest, NextResponse } from 'next/server';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { createAdminSupabaseClient } from '@/lib/supabase/admin';

/**
 * POST /api/nodes/[nodeId]/verify-backup
 * Proxies backup verification request to the node agent.
 */
export async function POST(
  _request: NextRequest,
  { params }: { params: Promise<{ nodeId: string }> }
) {
  const { nodeId } = await params;

  const supabase = await createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const admin = createAdminSupabaseClient();
  const { data: node } = await admin
    .from('nodes')
    .select('ip_address')
    .eq('id', nodeId)
    .single();

  if (!node || !node.ip_address) {
    return NextResponse.json({ error: 'Node not found or no IP address' }, { status: 404 });
  }

  try {
    const res = await fetch(`http://${node.ip_address}:3100/backup/verify-latest`, {
      method: 'POST',
      signal: AbortSignal.timeout(15_000),
    });

    if (!res.ok) {
      return NextResponse.json({ error: 'Node returned error' }, { status: 502 });
    }

    const result = await res.json();
    return NextResponse.json(result);
  } catch (err: any) {
    return NextResponse.json({ error: 'node_unreachable', message: err.message }, { status: 502 });
  }
}
