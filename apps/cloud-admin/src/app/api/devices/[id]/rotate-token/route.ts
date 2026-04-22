import { NextRequest, NextResponse } from 'next/server';
import { createAdminSupabaseClient } from '@/lib/supabase/admin';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { writeAuditLog } from '@/lib/audit';
import { ENROLLMENT_TOKEN_TTL_HOURS } from '@pulse/shared';

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: deviceId } = await params;
  const supabase = createAdminSupabaseClient();

  const { data: device } = await supabase
    .from('devices')
    .select('id, tenant_id, name')
    .eq('id', deviceId)
    .single();

  const newToken = crypto.randomUUID();
  const expiresAt = new Date(Date.now() + ENROLLMENT_TOKEN_TTL_HOURS * 60 * 60 * 1000).toISOString();

  const { error } = await supabase
    .from('devices')
    .update({
      enrollment_token: newToken,
      status: 'pending',
      metadata: { expires_at: expiresAt },
    })
    .eq('id', deviceId);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  if (device?.tenant_id) {
    let actorId: string | null = null;
    try {
      const server = await createSupabaseServerClient();
      const { data: { user } } = await server.auth.getUser();
      actorId = user?.id ?? null;
    } catch {}

    await writeAuditLog(supabase, {
      tenant_id: device.tenant_id,
      user_id: actorId,
      event_type: 'device_token_rotated',
      entity_type: 'device',
      entity_id: deviceId,
      description: `Rotated enrollment token for ${device.name ?? deviceId}`,
      ip_address: request.headers.get('x-forwarded-for') ?? null,
    });
  }

  return NextResponse.json({ enrollment_token: newToken, expires_at: expiresAt });
}
