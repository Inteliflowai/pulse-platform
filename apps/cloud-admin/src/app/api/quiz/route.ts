import { NextRequest, NextResponse } from 'next/server';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { createAdminSupabaseClient } from '@/lib/supabase/admin';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { title, description, time_limit_minutes, pass_percentage, max_attempts, shuffle_questions, show_results, sequence_id, questions } = body;

    const supabase = await createSupabaseServerClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { data: profile } = await supabase.from('users').select('tenant_id').eq('id', user.id).single();
    if (!profile) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const admin = createAdminSupabaseClient();

    const { data: quiz, error: quizErr } = await admin
      .from('quiz_definitions')
      .insert({
        tenant_id: profile.tenant_id,
        title,
        description,
        time_limit_minutes: time_limit_minutes || null,
        pass_percentage: pass_percentage ?? 50,
        max_attempts: max_attempts ?? 1,
        shuffle_questions: shuffle_questions ?? false,
        show_results: show_results ?? true,
        sequence_id: sequence_id || null,
        created_by: user.id,
        source: 'pulse',
        status: 'draft',
      })
      .select()
      .single();

    if (quizErr) return NextResponse.json({ error: quizErr.message }, { status: 500 });

    // Insert questions
    if (questions && Array.isArray(questions) && questions.length > 0) {
      const rows = questions.map((q: any, i: number) => ({
        quiz_id: quiz.id,
        sort_order: i,
        question_type: q.question_type,
        question_text: q.question_text,
        options: q.options ?? [],
        correct_answer: q.correct_answer ?? null,
        points: q.points ?? 1,
        explanation: q.explanation ?? null,
      }));

      await admin.from('quiz_questions').insert(rows);
    }

    return NextResponse.json(quiz, { status: 201 });
  } catch {
    return NextResponse.json({ error: 'Invalid request' }, { status: 400 });
  }
}
