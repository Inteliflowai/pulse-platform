import { NextRequest, NextResponse } from 'next/server';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { createAdminSupabaseClient } from '@/lib/supabase/admin';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ quizId: string }> }
) {
  const { quizId } = await params;
  const supabase = await createSupabaseServerClient();

  const { data: quiz } = await supabase.from('quiz_definitions').select('*').eq('id', quizId).single();
  if (!quiz) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  const { data: questions } = await supabase
    .from('quiz_questions')
    .select('*')
    .eq('quiz_id', quizId)
    .order('sort_order');

  // Get attempt stats
  const { data: attempts } = await supabase
    .from('quiz_attempts')
    .select('id, score, max_score, percentage, passed, status')
    .eq('quiz_id', quizId);

  const completed = (attempts ?? []).filter((a) => a.status === 'completed');
  const avgScore = completed.length > 0
    ? completed.reduce((s, a) => s + (a.percentage ?? 0), 0) / completed.length
    : null;

  return NextResponse.json({
    quiz,
    questions: questions ?? [],
    stats: {
      total_attempts: (attempts ?? []).length,
      completed: completed.length,
      avg_score: avgScore,
      pass_rate: completed.length > 0
        ? (completed.filter((a) => a.passed).length / completed.length * 100)
        : null,
    },
  });
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ quizId: string }> }
) {
  try {
    const { quizId } = await params;
    const body = await request.json();
    const admin = createAdminSupabaseClient();

    const { error } = await admin.from('quiz_definitions').update(body).eq('id', quizId);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ error: 'Invalid request' }, { status: 400 });
  }
}
