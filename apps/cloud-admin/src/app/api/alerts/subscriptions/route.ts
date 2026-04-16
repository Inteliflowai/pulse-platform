import { NextRequest, NextResponse } from 'next/server';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { createAdminSupabaseClient } from '@/lib/supabase/admin';

/**
 * GET /api/alerts/subscriptions — list user's subscriptions
 */
export async function GET() {
  const supabase = await createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { data } = await supabase
    .from('alert_subscriptions')
    .select('*')
    .eq('user_id', user.id);

  return NextResponse.json({ subscriptions: data ?? [] });
}

/**
 * POST /api/alerts/subscriptions — create or update subscription
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { alert_types, channels } = body;

    const supabase = await createSupabaseServerClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { data: profile } = await supabase
      .from('users')
      .select('tenant_id')
      .eq('id', user.id)
      .single();
    if (!profile) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const admin = createAdminSupabaseClient();

    // Upsert — one subscription per user
    const { data: existing } = await admin
      .from('alert_subscriptions')
      .select('id')
      .eq('user_id', user.id)
      .limit(1)
      .single();

    if (existing) {
      const { data, error } = await admin
        .from('alert_subscriptions')
        .update({ alert_types: alert_types ?? [], channels: channels ?? {} })
        .eq('id', existing.id)
        .select()
        .single();

      if (error) return NextResponse.json({ error: error.message }, { status: 500 });
      return NextResponse.json({ subscription: data });
    }

    const { data, error } = await admin
      .from('alert_subscriptions')
      .insert({
        user_id: user.id,
        tenant_id: profile.tenant_id,
        alert_types: alert_types ?? [],
        channels: channels ?? { email: true },
      })
      .select()
      .single();

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ subscription: data }, { status: 201 });
  } catch {
    return NextResponse.json({ error: 'Invalid request' }, { status: 400 });
  }
}
