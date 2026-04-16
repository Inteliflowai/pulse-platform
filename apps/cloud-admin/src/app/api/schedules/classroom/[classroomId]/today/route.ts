import { NextRequest, NextResponse } from 'next/server';
import { createSupabaseServerClient } from '@/lib/supabase/server';

/**
 * GET /api/schedules/classroom/[classroomId]/today
 * Get today's schedule for a specific classroom.
 */
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ classroomId: string }> }
) {
  const { classroomId } = await params;

  const supabase = await createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const today = new Date().toISOString().split('T')[0];
  const dayOfWeek = new Date().getDay();
  const isoWeekday = dayOfWeek === 0 ? 7 : dayOfWeek;

  // Fetch all non-cancelled schedules for this classroom
  const { data: schedules } = await supabase
    .from('classroom_schedules')
    .select(`
      *,
      class_groups(name),
      learning_sequences(name),
      users(full_name)
    `)
    .eq('classroom_id', classroomId)
    .neq('status', 'cancelled')
    .order('scheduled_time');

  // Filter to today's applicable schedules
  const todaySchedules = (schedules ?? []).filter((s: any) => {
    switch (s.recurrence) {
      case 'once':
        return s.scheduled_date === today;
      case 'daily':
        if (s.scheduled_date && s.scheduled_date > today) return false;
        if (s.recurrence_end_date && s.recurrence_end_date < today) return false;
        return true;
      case 'weekdays':
        if (s.scheduled_date && s.scheduled_date > today) return false;
        if (s.recurrence_end_date && s.recurrence_end_date < today) return false;
        return isoWeekday >= 1 && isoWeekday <= 5;
      case 'weekly':
      case 'custom': {
        if (s.scheduled_date && s.scheduled_date > today) return false;
        if (s.recurrence_end_date && s.recurrence_end_date < today) return false;
        const days: number[] = s.recurrence_days ?? [];
        return days.includes(isoWeekday);
      }
      default:
        return false;
    }
  });

  return NextResponse.json({ schedules: todaySchedules });
}
