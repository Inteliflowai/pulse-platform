import { NextRequest, NextResponse } from 'next/server';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { createAdminSupabaseClient } from '@/lib/supabase/admin';
import { requireNodeToken } from '@/lib/node-auth';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ quizId: string }> }
) {
  const { quizId } = await params;

  // Dual-mode auth: either a logged-in user (RLS scoped) or a node token.
  // Nodes need quiz content to serve offline classroom players; users see
  // quizzes their tenant owns.
  const nodeTokenPresent = !!request.headers.get('x-node-token');
  let tenantScope: string | null = null;

  if (nodeTokenPresent) {
    const auth = await requireNodeToken(request);
    if (!auth.ok) return auth.response;
    tenantScope = auth.node.tenant_id;
  } else {
    const sb = await createSupabaseServerClient();
    const { data: { user } } = await sb.auth.getUser();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    const { data: profile } = await sb.from('users').select('tenant_id').eq('id', user.id).single();
    if (!profile) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    tenantScope = profile.tenant_id;
  }

  const supabase = createAdminSupabaseClient();
  const { data: quiz } = await supabase
    .from('quiz_definitions')
    .select('*')
    .eq('id', quizId)
    .eq('tenant_id', tenantScope)
    .single();
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
    const sb = await createSupabaseServerClient();
    const { data: { user } } = await sb.auth.getUser();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    const { data: profile } = await sb.from('users').select('role, tenant_id').eq('id', user.id).single();
    if (!profile || !['super_admin', 'tenant_admin', 'site_admin', 'content_manager', 'teacher'].includes(profile.role)) {
      return NextResponse.json({ error: 'Insufficient permissions' }, { status: 403 });
    }

    const { quizId } = await params;
    const body = await request.json();
    const admin = createAdminSupabaseClient();

    // Tenant-scope the update; never let a caller edit quizzes across tenants.
    const { error } = await admin
      .from('quiz_definitions')
      .update(body)
      .eq('id', quizId)
      .eq('tenant_id', profile.tenant_id);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ error: 'Invalid request' }, { status: 400 });
  }
}
