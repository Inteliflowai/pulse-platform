import { NextRequest, NextResponse } from 'next/server';
import { createAdminSupabaseClient } from '@/lib/supabase/admin';

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ assignmentId: string }> }
) {
  try {
    const { assignmentId } = await params;
    const body = await request.json();
    const { status, error: errorMsg } = body;

    if (!status) return NextResponse.json({ error: 'Missing status' }, { status: 400 });

    const supabase = createAdminSupabaseClient();

    const update: Record<string, any> = { status };
    if (['completed', 'failed', 'rolled_back'].includes(status)) {
      update.completed_at = new Date().toISOString();
    }
    if (errorMsg) update.error = errorMsg;

    const { error } = await supabase
      .from('software_update_assignments')
      .update(update)
      .eq('id', assignmentId);

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ error: 'Invalid request body' }, { status: 400 });
  }
}
