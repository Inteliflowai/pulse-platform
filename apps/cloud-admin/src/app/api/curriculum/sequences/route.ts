import { NextRequest, NextResponse } from 'next/server';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { createAdminSupabaseClient } from '@/lib/supabase/admin';

export async function GET(request: NextRequest) {
  const supabase = await createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { data: profile } = await supabase.from('users').select('tenant_id').eq('id', user.id).single();
  if (!profile) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { data } = await supabase
    .from('learning_sequences')
    .select('*, grades(name), subjects(name), users(full_name)')
    .eq('tenant_id', profile.tenant_id)
    .order('created_at', { ascending: false });

  return NextResponse.json({ sequences: data ?? [] });
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { name, description, grade_id, subject_id, term_id, package_id, items } = body;

    const supabase = await createSupabaseServerClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { data: profile } = await supabase.from('users').select('tenant_id').eq('id', user.id).single();
    if (!profile) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const admin = createAdminSupabaseClient();

    // Create sequence
    const { data: seq, error: seqErr } = await admin
      .from('learning_sequences')
      .insert({
        tenant_id: profile.tenant_id,
        name,
        description,
        grade_id: grade_id || null,
        subject_id: subject_id || null,
        term_id: term_id || null,
        package_id: package_id || null,
        created_by: user.id,
        status: 'draft',
      })
      .select()
      .single();

    if (seqErr) return NextResponse.json({ error: seqErr.message }, { status: 500 });

    // Insert items if provided
    if (items && Array.isArray(items) && items.length > 0) {
      const rows = items.map((item: any, i: number) => ({
        sequence_id: seq.id,
        sort_order: i,
        item_type: item.item_type,
        title: item.title,
        asset_id: item.asset_id || null,
        quiz_id: item.quiz_id || null,
        duration_minutes: item.duration_minutes || null,
        auto_advance: item.auto_advance ?? true,
        require_completion: item.require_completion ?? true,
      }));

      await admin.from('sequence_items').insert(rows);
    }

    return NextResponse.json(seq, { status: 201 });
  } catch {
    return NextResponse.json({ error: 'Invalid request' }, { status: 400 });
  }
}
