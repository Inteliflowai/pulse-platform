import { NextRequest, NextResponse } from 'next/server';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { createAdminSupabaseClient } from '@/lib/supabase/admin';
import { requireNodeToken } from '@/lib/node-auth';

async function authTenantScope(request: NextRequest): Promise<{ tenant_id: string } | NextResponse> {
  if (request.headers.get('x-node-token')) {
    const auth = await requireNodeToken(request);
    if (!auth.ok) return auth.response;
    return { tenant_id: auth.node.tenant_id };
  }
  const sb = await createSupabaseServerClient();
  const { data: { user } } = await sb.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const { data: profile } = await sb.from('users').select('tenant_id').eq('id', user.id).single();
  if (!profile) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  return { tenant_id: profile.tenant_id };
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ sequenceId: string }> }
) {
  const scope = await authTenantScope(request);
  if (scope instanceof NextResponse) return scope;

  const { sequenceId } = await params;
  const admin = createAdminSupabaseClient();

  const { data: seq } = await admin
    .from('learning_sequences')
    .select('*, grades(name), subjects(name)')
    .eq('id', sequenceId)
    .eq('tenant_id', scope.tenant_id)
    .single();

  if (!seq) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  const { data: items } = await admin
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
    const sb = await createSupabaseServerClient();
    const { data: { user } } = await sb.auth.getUser();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    const { data: profile } = await sb.from('users').select('role, tenant_id').eq('id', user.id).single();
    if (!profile || !['super_admin', 'tenant_admin', 'site_admin', 'content_manager', 'teacher'].includes(profile.role)) {
      return NextResponse.json({ error: 'Insufficient permissions' }, { status: 403 });
    }

    const { sequenceId } = await params;
    const body = await request.json();
    const admin = createAdminSupabaseClient();

    const { error } = await admin
      .from('learning_sequences')
      .update(body)
      .eq('id', sequenceId)
      .eq('tenant_id', profile.tenant_id);

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ error: 'Invalid request' }, { status: 400 });
  }
}
