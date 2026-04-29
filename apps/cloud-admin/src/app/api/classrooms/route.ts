import { NextRequest, NextResponse } from 'next/server';
import { createAdminSupabaseClient } from '@/lib/supabase/admin';
import { createSupabaseServerClient } from '@/lib/supabase/server';

export async function GET(request: NextRequest) {
  const supabase = await createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { data: profile } = await supabase.from('users').select('tenant_id, site_id').eq('id', user.id).single();
  if (!profile) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  let query = supabase
    .from('classrooms')
    .select('*, nodes(name)')
    .order('name');

  // site_id scope if not super_admin
  if (profile.site_id) {
    query = query.eq('site_id', profile.site_id);
  }

  const { data, error } = await query;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ classrooms: data ?? [] });
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { name, room_code, node_id, site_id, capacity, delivery_mode } = body;

    if (!name || !site_id) {
      return NextResponse.json({ error: 'Missing name or site_id' }, { status: 400 });
    }

    const mode = delivery_mode === 'pulse_stb' ? 'pulse_stb' : 'pulse_local';
    const supabase = createAdminSupabaseClient();

    const { data, error } = await supabase
      .from('classrooms')
      .insert({ name, room_code, node_id: node_id || null, site_id, capacity: capacity || null, delivery_mode: mode })
      .select()
      .single();

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    return NextResponse.json(data, { status: 201 });
  } catch {
    return NextResponse.json({ error: 'Invalid request body' }, { status: 400 });
  }
}
