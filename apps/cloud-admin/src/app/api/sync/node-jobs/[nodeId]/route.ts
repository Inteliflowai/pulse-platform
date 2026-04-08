import { NextRequest, NextResponse } from 'next/server';
import { createAdminSupabaseClient } from '@/lib/supabase/admin';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ nodeId: string }> }
) {
  const { nodeId } = await params;
  const supabase = createAdminSupabaseClient();

  // Validate node exists
  const { data: node } = await supabase
    .from('nodes')
    .select('id')
    .eq('id', nodeId)
    .single();

  if (!node) {
    return NextResponse.json({ error: 'Node not found' }, { status: 404 });
  }

  // Fetch pending and in_progress jobs with package manifest
  const { data: jobs, error } = await supabase
    .from('sync_jobs')
    .select('*, packages(id, name, version, manifest, tenant_id)')
    .eq('node_id', nodeId)
    .in('status', ['pending', 'in_progress'])
    .order('created_at', { ascending: true });

  if (error) {
    return NextResponse.json({ error: 'Failed to fetch jobs' }, { status: 500 });
  }

  return NextResponse.json({ jobs: jobs ?? [] });
}
