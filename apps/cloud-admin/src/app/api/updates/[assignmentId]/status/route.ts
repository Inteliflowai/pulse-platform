import { NextRequest, NextResponse } from 'next/server';
import { createAdminSupabaseClient } from '@/lib/supabase/admin';
import { requireNodeToken } from '@/lib/node-auth';

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ assignmentId: string }> }
) {
  try {
    const auth = await requireNodeToken(request);
    if (!auth.ok) return auth.response;

    const { assignmentId } = await params;
    const body = await request.json();
    const { status, error: errorMsg } = body;

    if (!status) return NextResponse.json({ error: 'Missing status' }, { status: 400 });

    const supabase = createAdminSupabaseClient();

    // Verify assignment belongs to calling node.
    const { data: assignment } = await supabase
      .from('software_update_assignments')
      .select('id, node_id')
      .eq('id', assignmentId)
      .single();
    if (!assignment || assignment.node_id !== auth.node.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const update: Record<string, any> = { status };
    if (['completed', 'failed', 'rolled_back'].includes(status)) {
      update.completed_at = new Date().toISOString();
    }
    if (errorMsg) update.error = errorMsg;

    const { error } = await supabase
      .from('software_update_assignments')
      .update(update)
      .eq('id', assignmentId)
      .eq('node_id', auth.node.id);

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ error: 'Invalid request body' }, { status: 400 });
  }
}
