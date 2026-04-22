import { NextRequest, NextResponse } from 'next/server';
import { createAdminSupabaseClient } from '@/lib/supabase/admin';
import { requireNodeToken } from '@/lib/node-auth';

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await requireNodeToken(request);
    if (!auth.ok) return auth.response;

    const { id: deviceId } = await params;
    const body = await request.json();
    const { local_session_token, ip_address, device_name, device_type } = body;

    const supabase = createAdminSupabaseClient();

    // Confirm the device's classroom belongs to the calling node — a node
    // cannot enroll a device that isn't bound to one of its classrooms.
    const { data: device } = await supabase
      .from('devices')
      .select('id, classroom_id, classrooms(node_id)')
      .eq('id', deviceId)
      .single();
    const classroomNodeId = (device as any)?.classrooms?.node_id;
    if (!device || !classroomNodeId || classroomNodeId !== auth.node.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const update: Record<string, any> = {
      status: 'enrolled',
      ip_address,
      last_seen_at: new Date().toISOString(),
    };
    if (device_name) update.name = device_name;
    if (device_type) update.device_type = device_type;
    if (local_session_token) update.metadata = { local_session_token };

    const { error } = await supabase
      .from('devices')
      .update(update)
      .eq('id', deviceId);

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ error: 'Invalid request body' }, { status: 400 });
  }
}
