import { NextRequest, NextResponse } from 'next/server';
import { createSupabaseServerClient } from '@/lib/supabase/server';

export async function GET(request: NextRequest) {
  const type = request.nextUrl.searchParams.get('type') ?? 'quiz_results';
  const format = request.nextUrl.searchParams.get('format') ?? 'csv';

  const supabase = await createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { data: profile } = await supabase.from('users').select('tenant_id').eq('id', user.id).single();
  if (!profile) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  if (type === 'quiz_results') {
    const { data: attempts } = await supabase
      .from('quiz_attempts')
      .select('*, quiz_definitions(title)')
      .eq('status', 'completed')
      .order('completed_at', { ascending: false })
      .limit(1000);

    if (format === 'csv') {
      const headers = ['Quiz', 'Student ID', 'Score', 'Max Score', 'Percentage', 'Passed', 'Completed At'];
      const rows = (attempts ?? []).map((a: any) => [
        a.quiz_definitions?.title ?? '',
        a.student_id ?? '',
        a.score ?? 0,
        a.max_score ?? 0,
        a.percentage ?? 0,
        a.passed ? 'Yes' : 'No',
        a.completed_at ?? '',
      ]);

      const csv = [headers.join(','), ...rows.map((r) => r.map((c: any) => `"${String(c).replace(/"/g, '""')}"`).join(','))].join('\n');

      return new NextResponse(csv, {
        headers: {
          'Content-Type': 'text/csv',
          'Content-Disposition': `attachment; filename=quiz-results-${new Date().toISOString().slice(0, 10)}.csv`,
        },
      });
    }

    // JSON format
    return NextResponse.json({ attempts: attempts ?? [] });
  }

  if (type === 'progress') {
    const { data: progress } = await supabase
      .from('student_progress')
      .select('*, learning_sequences(name)')
      .order('updated_at', { ascending: false })
      .limit(1000);

    if (format === 'csv') {
      const headers = ['Student ID', 'Sequence', 'Status', 'Progress %', 'Watch Time (min)', 'Updated'];
      const rows = (progress ?? []).map((p: any) => [
        p.student_id ?? '',
        p.learning_sequences?.name ?? '',
        p.status ?? '',
        p.progress_pct ?? 0,
        Math.floor((p.watch_time_seconds ?? 0) / 60),
        p.updated_at ?? '',
      ]);

      const csv = [headers.join(','), ...rows.map((r) => r.map((c: any) => `"${String(c).replace(/"/g, '""')}"`).join(','))].join('\n');

      return new NextResponse(csv, {
        headers: {
          'Content-Type': 'text/csv',
          'Content-Disposition': `attachment; filename=progress-report-${new Date().toISOString().slice(0, 10)}.csv`,
        },
      });
    }

    return NextResponse.json({ progress: progress ?? [] });
  }

  return NextResponse.json({ error: 'Invalid report type' }, { status: 400 });
}
