import { NextRequest, NextResponse } from 'next/server';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { createAdminSupabaseClient } from '@/lib/supabase/admin';

// GET grades, subjects, terms, class_groups for this tenant
export async function GET(request: NextRequest) {
  const supabase = await createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { data: profile } = await supabase.from('users').select('tenant_id').eq('id', user.id).single();
  if (!profile) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const tid = profile.tenant_id;

  const [gradesRes, subjectsRes, termsRes, classGroupsRes] = await Promise.all([
    supabase.from('grades').select('*').eq('tenant_id', tid).order('sort_order'),
    supabase.from('subjects').select('*').eq('tenant_id', tid).order('name'),
    supabase.from('terms').select('*').eq('tenant_id', tid).order('start_date'),
    supabase.from('class_groups').select('*, grades(name), subjects(name), users(full_name, email)').eq('tenant_id', tid).order('name'),
  ]);

  return NextResponse.json({
    grades: gradesRes.data ?? [],
    subjects: subjectsRes.data ?? [],
    terms: termsRes.data ?? [],
    class_groups: classGroupsRes.data ?? [],
  });
}

// POST — create grade, subject, term, or class_group
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { type, ...data } = body;

    const supabase = await createSupabaseServerClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { data: profile } = await supabase.from('users').select('tenant_id').eq('id', user.id).single();
    if (!profile) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const admin = createAdminSupabaseClient();
    const row = { ...data, tenant_id: profile.tenant_id };

    let result;
    switch (type) {
      case 'grade':
        result = await admin.from('grades').insert(row).select().single();
        break;
      case 'subject':
        result = await admin.from('subjects').insert(row).select().single();
        break;
      case 'term':
        result = await admin.from('terms').insert(row).select().single();
        break;
      case 'class_group':
        result = await admin.from('class_groups').insert(row).select().single();
        break;
      default:
        return NextResponse.json({ error: 'Invalid type' }, { status: 400 });
    }

    if (result.error) return NextResponse.json({ error: result.error.message }, { status: 500 });
    return NextResponse.json(result.data, { status: 201 });
  } catch {
    return NextResponse.json({ error: 'Invalid request' }, { status: 400 });
  }
}
