import { NextRequest, NextResponse } from 'next/server';
import { createAdminSupabaseClient } from '@/lib/supabase/admin';

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: deviceId } = await params;
    const body = await request.json();
    const { local_session_token, ip_address, device_name, device_type } = body;

    const supabase = createAdminSupabaseClient();

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
