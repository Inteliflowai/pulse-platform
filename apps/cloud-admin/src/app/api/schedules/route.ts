import { NextRequest, NextResponse } from 'next/server';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { createAdminSupabaseClient } from '@/lib/supabase/admin';

/**
 * GET /api/schedules?site_id=&date_from=&date_to=
 * List schedules for the calendar view.
 */
export async function GET(request: NextRequest) {
  const supabase = await createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { data: profile } = await supabase
    .from('users')
    .select('tenant_id, site_id, role')
    .eq('id', user.id)
    .single();
  if (!profile) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { searchParams } = new URL(request.url);
  const siteId = searchParams.get('site_id') ?? profile.site_id;
  const dateFrom = searchParams.get('date_from');
  const dateTo = searchParams.get('date_to');
  const teacherId = searchParams.get('teacher_id');

  let query = supabase
    .from('classroom_schedules')
    .select(`
      *,
      classrooms(name, room_code),
      class_groups(name),
      learning_sequences(name),
      users(full_name, email)
    `)
    .eq('tenant_id', profile.tenant_id)
    .neq('status', 'cancelled')
    .order('scheduled_time');

  if (siteId) query = query.eq('site_id', siteId);
  if (teacherId) query = query.eq('teacher_id', teacherId);

  // For 'once' schedules, filter by date range
  if (dateFrom) query = query.or(`scheduled_date.gte.${dateFrom},scheduled_date.is.null`);
  if (dateTo) query = query.or(`scheduled_date.lte.${dateTo},scheduled_date.is.null`);

  const { data, error } = await query;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ schedules: data ?? [] });
}

/**
 * POST /api/schedules
 * Create a new classroom schedule.
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const {
      classroom_id, class_group_id, sequence_id, teacher_id,
      site_id, scheduled_date, scheduled_time, duration_minutes,
      recurrence, recurrence_days, recurrence_end_date, notes,
    } = body;

    if (!classroom_id || !class_group_id || !sequence_id || !scheduled_time || !site_id) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

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

    // Check for schedule conflicts (warn, don't block)
    const { data: conflicts } = await admin
      .from('classroom_schedules')
      .select('id, scheduled_time, duration_minutes, class_groups(name)')
      .eq('classroom_id', classroom_id)
      .neq('status', 'cancelled')
      .eq('scheduled_time', scheduled_time);

    const hasConflict = (conflicts ?? []).some((c: any) => {
      if (recurrence === 'once' && c.scheduled_date === scheduled_date) return true;
      if (recurrence !== 'once') return true;
      return false;
    });

    const { data, error } = await admin
      .from('classroom_schedules')
      .insert({
        classroom_id,
        class_group_id,
        sequence_id,
        teacher_id: teacher_id || user.id,
        site_id,
        tenant_id: profile.tenant_id,
        scheduled_date: scheduled_date || null,
        scheduled_time,
        duration_minutes: duration_minutes ?? 60,
        recurrence: recurrence ?? 'once',
        recurrence_days: recurrence_days ?? [],
        recurrence_end_date: recurrence_end_date || null,
        notes: notes || null,
        status: 'scheduled',
      })
      .select()
      .single();

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    return NextResponse.json({
      schedule: data,
      warning: hasConflict ? 'Schedule overlaps with an existing class in this classroom' : null,
    }, { status: 201 });
  } catch {
    return NextResponse.json({ error: 'Invalid request body' }, { status: 400 });
  }
}
