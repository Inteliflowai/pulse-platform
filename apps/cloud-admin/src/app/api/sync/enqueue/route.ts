import { NextRequest, NextResponse } from 'next/server';
import { createAdminSupabaseClient } from '@/lib/supabase/admin';
import { createSupabaseServerClient } from '@/lib/supabase/server';

export async function POST(request: NextRequest) {
  try {
    // Only content-capable roles can queue sync jobs.
    const sb = await createSupabaseServerClient();
    const { data: { user } } = await sb.auth.getUser();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    const { data: profile } = await sb.from('users').select('role, tenant_id').eq('id', user.id).single();
    if (!profile || !['super_admin', 'tenant_admin', 'site_admin', 'content_manager'].includes(profile.role)) {
      return NextResponse.json({ error: 'Insufficient permissions' }, { status: 403 });
    }

    const body = await request.json();
    const { package_id, node_ids } = body;

    if (!package_id) {
      return NextResponse.json({ error: 'Missing package_id' }, { status: 400 });
    }

    const supabase = createAdminSupabaseClient();

    // Validate package is published
    const { data: pkg, error: pkgErr } = await supabase
      .from('packages')
      .select('id, tenant_id, status, target_sites, manifest')
      .eq('id', package_id)
      .single();

    if (pkgErr || !pkg) {
      return NextResponse.json({ error: 'Package not found' }, { status: 404 });
    }

    // Don't let a user enqueue a package from another tenant — super_admin excepted.
    if (profile.role !== 'super_admin' && pkg.tenant_id !== profile.tenant_id) {
      return NextResponse.json({ error: 'Package not found' }, { status: 404 });
    }

    if (pkg.status !== 'published') {
      return NextResponse.json({ error: 'Package must be published before syncing' }, { status: 400 });
    }

    // Determine target nodes
    let targetNodeIds: string[] = node_ids ?? [];

    if (targetNodeIds.length === 0) {
      // Get all active nodes for target sites
      const targetSites: string[] = (pkg.target_sites as string[]) ?? [];

      let nodesQuery = supabase
        .from('nodes')
        .select('id')
        .eq('tenant_id', pkg.tenant_id)
        .eq('status', 'active');

      if (targetSites.length > 0) {
        nodesQuery = nodesQuery.in('site_id', targetSites);
      }

      const { data: nodes } = await nodesQuery;
      targetNodeIds = (nodes ?? []).map((n) => n.id);
    }

    if (targetNodeIds.length === 0) {
      return NextResponse.json({ error: 'No active target nodes found' }, { status: 400 });
    }

    // Check existing jobs and create new ones
    const jobs: any[] = [];

    for (const nodeId of targetNodeIds) {
      // Skip if pending/in_progress job already exists
      const { data: existing } = await supabase
        .from('sync_jobs')
        .select('id')
        .eq('package_id', package_id)
        .eq('node_id', nodeId)
        .in('status', ['pending', 'in_progress'])
        .limit(1);

      if (existing && existing.length > 0) continue;

      const totalBytes = (pkg.manifest as any)?.assets?.reduce(
        (sum: number, a: any) => sum + (a.size_bytes ?? 0), 0
      ) ?? 0;

      const { data: job, error: insertErr } = await supabase
        .from('sync_jobs')
        .insert({
          package_id,
          node_id: nodeId,
          status: 'pending',
          bytes_total: totalBytes,
        })
        .select()
        .single();

      if (!insertErr && job) jobs.push(job);
    }

    return NextResponse.json({ enqueued: jobs.length, jobs });
  } catch {
    return NextResponse.json({ error: 'Invalid request body' }, { status: 400 });
  }
}
