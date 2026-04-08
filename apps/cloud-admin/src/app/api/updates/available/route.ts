import { NextRequest, NextResponse } from 'next/server';
import { createAdminSupabaseClient } from '@/lib/supabase/admin';

export async function GET(request: NextRequest) {
  const nodeId = request.nextUrl.searchParams.get('node_id');
  if (!nodeId) return NextResponse.json({ error: 'Missing node_id' }, { status: 400 });

  const supabase = createAdminSupabaseClient();

  // Get node's current version
  const { data: node } = await supabase.from('nodes').select('version').eq('id', nodeId).single();
  if (!node) return NextResponse.json({ error: 'Node not found' }, { status: 404 });

  // Get latest released version
  const { data: release } = await supabase
    .from('software_releases')
    .select('*')
    .eq('status', 'released')
    .order('released_at', { ascending: false })
    .limit(1)
    .single();

  if (!release) {
    return NextResponse.json({ update_available: false });
  }

  // Check if there's an assignment for this node
  const { data: assignment } = await supabase
    .from('software_update_assignments')
    .select('id, status')
    .eq('release_id', release.id)
    .eq('node_id', nodeId)
    .single();

  const updateAvailable = release.version !== node.version;

  return NextResponse.json({
    update_available: updateAvailable,
    current_version: node.version,
    latest_version: release.version,
    release_id: release.id,
    download_url: release.download_url,
    checksum: release.checksum,
    release_notes: release.release_notes,
    assignment_id: assignment?.id ?? null,
    assignment_status: assignment?.status ?? null,
  });
}
