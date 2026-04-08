import { NextRequest, NextResponse } from 'next/server';
import { createSupabaseServerClient } from '@/lib/supabase/server';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const supabase = await createSupabaseServerClient();

  const { data: classroom, error } = await supabase
    .from('classrooms')
    .select('*, nodes(name, ip_address)')
    .eq('id', id)
    .single();

  if (error || !classroom) {
    return NextResponse.json({ error: 'Classroom not found' }, { status: 404 });
  }

  // Get devices for this classroom
  const { data: devices } = await supabase
    .from('devices')
    .select('*')
    .eq('classroom_id', id)
    .order('created_at', { ascending: false });

  return NextResponse.json({ classroom, devices: devices ?? [] });
}
