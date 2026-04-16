import { NextRequest, NextResponse } from 'next/server';
import { createSupabaseServerClient } from '@/lib/supabase/server';

/**
 * GET /api/schedules/[scheduleId]/readiness
 * Check if the sequence content is synced to the classroom's node.
 */
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ scheduleId: string }> }
) {
  const { scheduleId } = await params;

  const supabase = await createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  // Get schedule with classroom and sequence info
  const { data: schedule } = await supabase
    .from('classroom_schedules')
    .select('*, classrooms(node_id), learning_sequences(package_id)')
    .eq('id', scheduleId)
    .single();

  if (!schedule) return NextResponse.json({ error: 'Schedule not found' }, { status: 404 });

  const nodeId = (schedule.classrooms as any)?.node_id;
  const packageId = (schedule.learning_sequences as any)?.package_id;

  if (!packageId) {
    return NextResponse.json({
      status: 'no_content',
      assets_total: 0,
      assets_ready: 0,
      sync_job_status: null,
      sync_progress_pct: null,
      estimated_ready_at: null,
    });
  }

  if (!nodeId) {
    return NextResponse.json({
      status: 'not_ready',
      assets_total: 0,
      assets_ready: 0,
      sync_job_status: null,
      sync_progress_pct: null,
      estimated_ready_at: null,
    });
  }

  // Check sync jobs for this package on this node
  const { data: syncJobs } = await supabase
    .from('sync_jobs')
    .select('id, status, progress_pct, completed_at, started_at')
    .eq('package_id', packageId)
    .eq('node_id', nodeId)
    .order('created_at', { ascending: false })
    .limit(1);

  const latestJob = syncJobs?.[0] ?? null;

  // Count assets in package
  const { count: assetsTotal } = await supabase
    .from('package_assets')
    .select('id', { count: 'exact', head: true })
    .eq('package_id', packageId);

  let status: string;
  let syncProgressPct: number | null = null;
  let estimatedReadyAt: string | null = null;

  if (!latestJob) {
    status = 'not_ready';
  } else if (latestJob.status === 'completed') {
    status = 'ready';
  } else if (latestJob.status === 'in_progress') {
    status = 'syncing';
    syncProgressPct = latestJob.progress_pct ?? 0;
    // Estimate completion: linear extrapolation from started_at
    if (latestJob.started_at && syncProgressPct !== null && syncProgressPct > 0) {
      const elapsed = Date.now() - new Date(latestJob.started_at).getTime();
      const total = elapsed / (syncProgressPct / 100);
      estimatedReadyAt = new Date(new Date(latestJob.started_at).getTime() + total).toISOString();
    }
  } else {
    status = 'not_ready';
  }

  return NextResponse.json({
    status,
    assets_total: assetsTotal ?? 0,
    assets_ready: status === 'ready' ? (assetsTotal ?? 0) : 0,
    sync_job_status: latestJob?.status ?? null,
    sync_progress_pct: syncProgressPct,
    estimated_ready_at: estimatedReadyAt,
  });
}
