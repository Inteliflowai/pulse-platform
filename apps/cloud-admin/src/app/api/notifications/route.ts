import { NextRequest, NextResponse } from 'next/server';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { createAdminSupabaseClient } from '@/lib/supabase/admin';

// GET — list notifications for current user
export async function GET(request: NextRequest) {
  const supabase = await createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const unreadOnly = request.nextUrl.searchParams.get('unread') === 'true';
  let query = supabase
    .from('notifications')
    .select('*')
    .or(`user_id.eq.${user.id},user_id.is.null`)
    .order('created_at', { ascending: false })
    .limit(50);

  if (unreadOnly) query = query.eq('read', false);

  const { data } = await query;
  return NextResponse.json({ notifications: data ?? [] });
}

// POST — create notification (admin/system)
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { tenant_id, user_id, type, title, message, link } = body;

    if (!type || !title) {
      return NextResponse.json({ error: 'Missing type or title' }, { status: 400 });
    }

    const admin = createAdminSupabaseClient();
    const { data, error } = await admin
      .from('notifications')
      .insert({ tenant_id, user_id: user_id ?? null, type, title, message, link })
      .select()
      .single();

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json(data, { status: 201 });
  } catch {
    return NextResponse.json({ error: 'Invalid request' }, { status: 400 });
  }
}

// PATCH — mark notifications as read
export async function PATCH(request: NextRequest) {
  try {
    const body = await request.json();
    const { ids } = body;

    const supabase = await createSupabaseServerClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    if (ids && Array.isArray(ids)) {
      await supabase.from('notifications').update({ read: true }).in('id', ids).eq('user_id', user.id);
    } else {
      // Mark all as read
      await supabase.from('notifications').update({ read: true }).eq('user_id', user.id).eq('read', false);
    }

    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ error: 'Invalid request' }, { status: 400 });
  }
}
