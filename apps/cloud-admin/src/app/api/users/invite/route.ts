import { NextRequest, NextResponse } from 'next/server';
import { createAdminSupabaseClient } from '@/lib/supabase/admin';
import { createSupabaseServerClient } from '@/lib/supabase/server';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { email, role, site_id, tenant_id } = body;

    if (!email || !role) {
      return NextResponse.json({ error: 'Missing email or role' }, { status: 400 });
    }

    // Verify requesting user is admin
    const supabase = await createSupabaseServerClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { data: profile } = await supabase.from('users').select('role, tenant_id').eq('id', user.id).single();
    if (!profile || !['super_admin', 'tenant_admin', 'site_admin'].includes(profile.role)) {
      return NextResponse.json({ error: 'Insufficient permissions' }, { status: 403 });
    }

    const admin = createAdminSupabaseClient();
    const tid = tenant_id || profile.tenant_id;

    // Create auth user with invite
    const { data: authData, error: authErr } = await admin.auth.admin.createUser({
      email,
      email_confirm: false,
      user_metadata: { role, tenant_id: tid },
    });

    if (authErr) {
      // User may already exist
      if (authErr.message.includes('already been registered')) {
        return NextResponse.json({ error: 'User with this email already exists' }, { status: 409 });
      }
      return NextResponse.json({ error: authErr.message }, { status: 500 });
    }

    // Create users row
    const { error: insertErr } = await admin.from('users').insert({
      id: authData.user.id,
      tenant_id: tid,
      site_id: site_id || null,
      email,
      role,
    });

    if (insertErr) {
      return NextResponse.json({ error: insertErr.message }, { status: 500 });
    }

    // Send password reset email so user can set their password
    await admin.auth.admin.generateLink({
      type: 'magiclink',
      email,
    });

    // Audit log
    await admin.from('audit_logs').insert({
      tenant_id: tid,
      user_id: user.id,
      event_type: 'user_invited',
      entity_type: 'user',
      entity_id: authData.user.id,
      description: `Invited ${email} as ${role}`,
    });

    return NextResponse.json({ ok: true, user_id: authData.user.id });
  } catch {
    return NextResponse.json({ error: 'Invalid request' }, { status: 400 });
  }
}
