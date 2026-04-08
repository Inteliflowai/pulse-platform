import { NextRequest, NextResponse } from 'next/server';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { createAdminSupabaseClient } from '@/lib/supabase/admin';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ sequenceId: string }> }
) {
  const { sequenceId } = await params;
  const supabase = await createSupabaseServerClient();

  const { data: seq } = await supabase
    .from('learning_sequences')
    .select('*, grades(name), subjects(name)')
    .eq('id', sequenceId)
    .single();

  if (!seq) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  const { data: items } = await supabase
    .from('sequence_items')
    .select('*, assets(filename, mime_type), quiz_definitions(title, status)')
    .eq('sequence_id', sequenceId)
    .order('sort_order');

  return NextResponse.json({ sequence: seq, items: items ?? [] });
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ sequenceId: string }> }
) {
  try {
    const { sequenceId } = await params;
    const body = await request.json();
    const admin = createAdminSupabaseClient();

    const { error } = await admin
      .from('learning_sequences')
      .update(body)
      .eq('id', sequenceId);

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ error: 'Invalid request' }, { status: 400 });
  }
}
