import { NextRequest, NextResponse } from 'next/server';
import { createAdminSupabaseClient } from '@/lib/supabase/admin';
import { ENROLLMENT_TOKEN_TTL_HOURS } from '@pulse/shared';

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: deviceId } = await params;
  const supabase = createAdminSupabaseClient();

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

  return NextResponse.json({ enrollment_token: newToken, expires_at: expiresAt });
}
