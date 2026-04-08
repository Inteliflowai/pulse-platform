import { NextRequest, NextResponse } from 'next/server';
import { createAdminSupabaseClient } from '@/lib/supabase/admin';

export async function GET(request: NextRequest) {
  const token = request.nextUrl.searchParams.get('token');
  if (!token) {
    return NextResponse.json({ error: 'Missing token' }, { status: 400 });
  }

  const supabase = createAdminSupabaseClient();

  const { data: device } = await supabase
    .from('devices')
    .select('id, classroom_id, node_id, tenant_id, status, metadata')
    .eq('enrollment_token', token)
    .single();

  if (!device) {
    return NextResponse.json({ error: 'Token not found', valid: false }, { status: 404 });
  }

  if (device.status !== 'pending') {
    return NextResponse.json({ error: 'Token already used', valid: false }, { status: 409 });
  }

  // Check expiry
  const meta = device.metadata as any;
  if (meta?.expires_at && new Date(meta.expires_at) < new Date()) {
    return NextResponse.json({ error: 'Token expired', valid: false }, { status: 410 });
  }

  // Get classroom info
  const { data: classroom } = await supabase
    .from('classrooms')
    .select('id, name, room_code')
    .eq('id', device.classroom_id)
    .single();

  return NextResponse.json({
    valid: true,
    device_id: device.id,
    classroom_id: device.classroom_id,
    classroom_name: classroom?.name,
    node_id: device.node_id,
    tenant_id: device.tenant_id,
  });
}
