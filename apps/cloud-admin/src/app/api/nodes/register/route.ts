import { NextRequest, NextResponse } from 'next/server';
import { createAdminSupabaseClient } from '@/lib/supabase/admin';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { registration_token, hostname, version, ip_address, storage_total_gb } = body;

    if (!registration_token || !hostname || !version || !ip_address || storage_total_gb == null) {
      return NextResponse.json(
        { error: 'Missing required fields: registration_token, hostname, version, ip_address, storage_total_gb' },
        { status: 400 }
      );
    }

    const supabase = createAdminSupabaseClient();

    // Find node by registration token
    const { data: node, error: findError } = await supabase
      .from('nodes')
      .select('id, name, site_id, tenant_id, status')
      .eq('registration_token', registration_token)
      .single();

    if (findError || !node) {
      return NextResponse.json({ error: 'Registration token not found' }, { status: 404 });
    }

    if (node.status !== 'pending') {
      return NextResponse.json({ error: 'Node is already registered' }, { status: 409 });
    }

    // Activate the node
    const { error: updateError } = await supabase
      .from('nodes')
      .update({
        status: 'active',
        hostname,
        version,
        ip_address,
        storage_total_gb,
        registered_at: new Date().toISOString(),
        last_seen_at: new Date().toISOString(),
      })
      .eq('id', node.id);

    if (updateError) {
      return NextResponse.json({ error: 'Failed to register node' }, { status: 500 });
    }

    // Write audit log
    await supabase.from('audit_logs').insert({
      tenant_id: node.tenant_id,
      event_type: 'node_registered',
      entity_type: 'node',
      entity_id: node.id,
      description: `Node "${node.name}" registered from ${ip_address}`,
      ip_address,
    });

    return NextResponse.json({
      node_id: node.id,
      node_name: node.name,
      site_id: node.site_id,
      tenant_id: node.tenant_id,
      jellyfin_api_key: process.env.JELLYFIN_API_KEY ?? '',
      cloud_api_url: process.env.CLOUD_API_URL ?? '',
    });
  } catch {
    return NextResponse.json({ error: 'Invalid request body' }, { status: 400 });
  }
}
