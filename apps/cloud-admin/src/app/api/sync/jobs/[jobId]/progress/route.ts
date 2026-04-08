import { NextRequest, NextResponse } from 'next/server';
import { createAdminSupabaseClient } from '@/lib/supabase/admin';

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ jobId: string }> }
) {
  try {
    const { jobId } = await params;
    const body = await request.json();
    const { bytes_transferred, progress_pct, status } = body;

    const supabase = createAdminSupabaseClient();

    const update: Record<string, any> = {};
    if (bytes_transferred != null) update.bytes_transferred = bytes_transferred;
    if (progress_pct != null) update.progress_pct = progress_pct;
    if (status) {
      update.status = status;
      if (status === 'in_progress' && !update.started_at) {
        update.started_at = new Date().toISOString();
      }
    }

    const { error } = await supabase
      .from('sync_jobs')
      .update(update)
      .eq('id', jobId);

    if (error) {
      return NextResponse.json({ error: 'Failed to update job' }, { status: 500 });
    }

    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ error: 'Invalid request body' }, { status: 400 });
  }
}
