import { NextRequest, NextResponse } from 'next/server';
import { createAdminSupabaseClient } from '@/lib/supabase/admin';

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ jobId: string }> }
) {
  try {
    const { jobId } = await params;
    const body = await request.json();
    const { status, error_message } = body;

    if (!status || !['completed', 'failed'].includes(status)) {
      return NextResponse.json({ error: 'status must be "completed" or "failed"' }, { status: 400 });
    }

    const supabase = createAdminSupabaseClient();

    // Get job for audit log
    const { data: job } = await supabase
      .from('sync_jobs')
      .select('id, package_id, node_id, packages(name, tenant_id)')
      .eq('id', jobId)
      .single();

    if (!job) {
      return NextResponse.json({ error: 'Job not found' }, { status: 404 });
    }

    const now = new Date().toISOString();

    const update: Record<string, any> = {
      status,
      completed_at: now,
    };

    if (status === 'completed') {
      update.progress_pct = 100;
    }
    if (error_message) {
      update.error_message = error_message;
    }

    const { data: updateData, error: updateErr, count } = await supabase
      .from('sync_jobs')
      .update(update)
      .eq('id', jobId)
      .select('id, status');

    console.log('[complete] jobId:', jobId, 'status:', status, 'result:', JSON.stringify(updateData), 'error:', updateErr?.message, 'serviceKey:', process.env.SUPABASE_SERVICE_ROLE_KEY?.slice(0, 15) + '...');

    if (updateErr) {
      return NextResponse.json({ error: 'Failed to update job: ' + updateErr.message }, { status: 500 });
    }

    // Write audit log
    const pkg = (job as any).packages;
    await supabase.from('audit_logs').insert({
      tenant_id: pkg?.tenant_id,
      event_type: status === 'completed' ? 'sync_completed' : 'sync_failed',
      entity_type: 'sync_job',
      entity_id: jobId,
      description: `Sync job for "${pkg?.name}" ${status}${error_message ? ': ' + error_message : ''}`,
    });

    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ error: 'Invalid request body' }, { status: 400 });
  }
}
