import { NextRequest, NextResponse } from 'next/server';
import { createAdminSupabaseClient } from '@/lib/supabase/admin';
import { ENROLLMENT_TOKEN_TTL_HOURS } from '@pulse/shared';

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: classroomId } = await params;
  const supabase = createAdminSupabaseClient();

  // Get classroom with node info
  const { data: classroom } = await supabase
    .from('classrooms')
    .select('id, site_id, node_id, nodes(ip_address, tenant_id)')
    .eq('id', classroomId)
    .single();

  if (!classroom) {
    return NextResponse.json({ error: 'Classroom not found' }, { status: 404 });
  }

  const node = (classroom as any).nodes;
  const tenantId = node?.tenant_id;
  const nodeIp = node?.ip_address ?? 'NODE_IP';

  const enrollmentToken = crypto.randomUUID();
  const expiresAt = new Date(Date.now() + ENROLLMENT_TOKEN_TTL_HOURS * 60 * 60 * 1000).toISOString();

  // Insert a pending device record with the enrollment token
  const { data: device, error } = await supabase
    .from('devices')
    .insert({
      classroom_id: classroomId,
      node_id: classroom.node_id,
      tenant_id: tenantId,
      name: `Pending Device`,
      device_type: 'browser',
      enrollment_token: enrollmentToken,
      status: 'pending',
      metadata: { expires_at: expiresAt },
    })
    .select('id')
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const enrollUrl = `http://${nodeIp}:3100/enroll?code=${enrollmentToken}`;

  return NextResponse.json({
    device_id: device.id,
    enrollment_token: enrollmentToken,
    enroll_url: enrollUrl,
    expires_at: expiresAt,
    qr_data: enrollUrl,
  });
}
