import { NextRequest, NextResponse } from 'next/server';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { createAdminSupabaseClient } from '@/lib/supabase/admin';

/**
 * PATCH /api/schedules/[scheduleId]
 * Update a schedule.
 */
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ scheduleId: string }> }
) {
  try {
    const { scheduleId } = await params;
    const body = await request.json();

    const supabase = await createSupabaseServerClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const admin = createAdminSupabaseClient();

    // Only allow updating certain fields
    const allowed: Record<string, any> = {};
    const fields = [
      'classroom_id', 'class_group_id', 'sequence_id', 'teacher_id',
      'scheduled_date', 'scheduled_time', 'duration_minutes',
      'recurrence', 'recurrence_days', 'recurrence_end_date',
      'status', 'notes',
    ];
    for (const f of fields) {
      if (body[f] !== undefined) allowed[f] = body[f];
    }

    const { data, error } = await admin
      .from('classroom_schedules')
      .update(allowed)
      .eq('id', scheduleId)
      .select()
      .single();

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ schedule: data });
  } catch {
    return NextResponse.json({ error: 'Invalid request' }, { status: 400 });
  }
}

/**
 * DELETE /api/schedules/[scheduleId]
 * Cancel a schedule (soft delete: set status to cancelled).
 */
export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ scheduleId: string }> }
) {
  const { scheduleId } = await params;

  const supabase = await createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const admin = createAdminSupabaseClient();

  const { error } = await admin
    .from('classroom_schedules')
    .update({ status: 'cancelled', ended_at: new Date().toISOString() })
    .eq('id', scheduleId);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
