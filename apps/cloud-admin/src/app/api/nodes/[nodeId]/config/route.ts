import { NextRequest, NextResponse } from 'next/server';
import { createAdminSupabaseClient } from '@/lib/supabase/admin';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ nodeId: string }> }
) {
  const { nodeId } = await params;

  // Simple shared secret auth
  const authHeader = request.headers.get('x-node-secret');
  if (!authHeader || authHeader !== process.env.SUPABASE_SERVICE_ROLE_KEY) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const supabase = createAdminSupabaseClient();

  const { data: node } = await supabase
    .from('nodes')
    .select('id, site_id, tenant_id')
    .eq('id', nodeId)
    .single();

  if (!node) {
    return NextResponse.json({ error: 'Node not found' }, { status: 404 });
  }

  // Fetch classrooms for this node
  const { data: classrooms } = await supabase
    .from('classrooms')
    .select('*')
    .eq('node_id', nodeId);

  // Fetch published packages targeting this node's site
  const { data: packages } = await supabase
    .from('packages')
    .select('id, name, manifest')
    .eq('tenant_id', node.tenant_id)
    .eq('status', 'published');

  // Filter packages that target this node's site
  const sitePackages = (packages ?? []).filter((pkg: any) => {
    const targets = pkg.manifest?.target_sites ?? pkg.target_sites ?? [];
    return targets.length === 0 || targets.includes(node.site_id);
  });

  return NextResponse.json({
    classrooms: classrooms ?? [],
    device_policies: {},
    feature_flags: {},
    current_packages: sitePackages.map((p: any) => ({
      id: p.id,
      name: p.name,
      manifest: p.manifest,
    })),
  });
}
