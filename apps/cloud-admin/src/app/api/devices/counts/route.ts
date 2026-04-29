import { NextRequest, NextResponse } from 'next/server';
import { createSupabaseServerClient } from '@/lib/supabase/server';

/**
 * Single source of truth for device-status aggregation.
 *
 * Returns tenant-wide totals + per-classroom enrolled counts in one query.
 * Replaces the three drift-prone implementations that previously lived in
 * monitoring/page, school/classrooms/page, and school/classrooms/[id]/page.
 */
export async function GET(_request: NextRequest) {
  const supabase = await createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { data: profile } = await supabase
    .from('users')
    .select('tenant_id')
    .eq('id', user.id)
    .single();
  if (!profile) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { data: devs, error } = await supabase
    .from('devices')
    .select('status, classroom_id')
    .eq('tenant_id', profile.tenant_id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const tenantTotals = { enrolled: 0, revoked: 0, pending: 0 };
  const perClassroomEnrolled: Record<string, number> = {};

  for (const d of devs ?? []) {
    if (d.status === 'enrolled') {
      tenantTotals.enrolled++;
      if (d.classroom_id) {
        perClassroomEnrolled[d.classroom_id] = (perClassroomEnrolled[d.classroom_id] ?? 0) + 1;
      }
    } else if (d.status === 'revoked') {
      tenantTotals.revoked++;
    } else {
      tenantTotals.pending++;
    }
  }

  return NextResponse.json({
    tenant: tenantTotals,
    per_classroom_enrolled: perClassroomEnrolled,
  });
}
