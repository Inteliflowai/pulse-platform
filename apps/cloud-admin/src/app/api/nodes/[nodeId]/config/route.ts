import { NextRequest, NextResponse } from 'next/server';
import { createAdminSupabaseClient } from '@/lib/supabase/admin';
import { requireNodeToken } from '@/lib/node-auth';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ nodeId: string }> }
) {
  const { nodeId } = await params;

  const auth = await requireNodeToken(request, { expectedNodeId: nodeId });
  if (!auth.ok) return auth.response;

  const supabase = createAdminSupabaseClient();

  const { data: node } = await supabase
    .from('nodes')
    .select('id, site_id, tenant_id')
    .eq('id', nodeId)
    .single();

  if (!node) {
    return NextResponse.json({ error: 'Node not found' }, { status: 404 });
  }

  // Fetch classrooms for this node
  const { data: classrooms } = await supabase
    .from('classrooms')
    .select('*')
    .eq('node_id', nodeId);

  // Fetch published packages targeting this node's site
  const { data: packages } = await supabase
    .from('packages')
    .select('id, name, manifest')
    .eq('tenant_id', node.tenant_id)
    .eq('status', 'published');

  // Filter packages that target this node's site
  const sitePackages = (packages ?? []).filter((pkg: any) => {
    const targets = pkg.manifest?.target_sites ?? pkg.target_sites ?? [];
    return targets.length === 0 || targets.includes(node.site_id);
  });

  // Fetch active/scheduled classroom schedules for this node's classrooms
  const classroomIds = (classrooms ?? []).map((c: any) => c.id);
  let schedules: any[] = [];
  let classGroupStudents: any[] = [];

  if (classroomIds.length > 0) {
    const { data: rawSchedules } = await supabase
      .from('classroom_schedules')
      .select(`
        id, classroom_id, class_group_id, sequence_id, teacher_id,
        scheduled_date, scheduled_time, duration_minutes,
        recurrence, recurrence_days, recurrence_end_date, status,
        class_groups(name, core_class_id),
        learning_sequences(name),
        users(full_name)
      `)
      .in('classroom_id', classroomIds)
      .in('status', ['scheduled', 'active']);

    schedules = (rawSchedules ?? []).map((s: any) => ({
      id: s.id,
      classroom_id: s.classroom_id,
      class_group_id: s.class_group_id,
      // CORE's canonical identity for this class — passed through to the node
      // so every lesson-complete event can include it without a lookup.
      core_class_id: s.class_groups?.core_class_id ?? null,
      sequence_id: s.sequence_id,
      teacher_id: s.teacher_id,
      teacher_name: s.users?.full_name ?? null,
      class_group_name: s.class_groups?.name ?? null,
      sequence_name: s.learning_sequences?.name ?? null,
      scheduled_date: s.scheduled_date,
      scheduled_time: s.scheduled_time,
      duration_minutes: s.duration_minutes,
      recurrence: s.recurrence,
      recurrence_days: s.recurrence_days ?? [],
      recurrence_end_date: s.recurrence_end_date,
      status: s.status,
    }));

    // Fetch class group students for the scheduled class groups
    const classGroupIds = [...new Set(schedules.map((s: any) => s.class_group_id))];
    if (classGroupIds.length > 0) {
      const { data: cgs } = await supabase
        .from('class_group_students')
        .select(`
          id, class_group_id, student_id,
          student_profiles(student_number, users(full_name))
        `)
        .in('class_group_id', classGroupIds)
        .eq('status', 'active');

      classGroupStudents = (cgs ?? []).map((c: any) => ({
        id: c.id,
        class_group_id: c.class_group_id,
        student_id: c.student_id,
        student_name: (c.student_profiles as any)?.users?.full_name ?? null,
        student_number: (c.student_profiles as any)?.student_number ?? null,
      }));
    }
  }

  // Per-tenant integration credentials (CORE Bearer key + optional URL
  // override). The node caches these in SQLite and uses them instead of
  // env vars on every lesson-complete / export-classes call. Only active
  // credentials are shipped — a 'not_provisioned' or 'revoked' row leaves
  // the node falling back to its env-var CORE_API_SECRET (if set).
  const { data: creds } = await supabase
    .from('tenant_integration_credentials')
    .select('service, api_key, api_url, status')
    .eq('tenant_id', node.tenant_id)
    .eq('status', 'active');

  const integration_credentials: Record<string, { api_key: string; api_url: string | null }> = {};
  for (const c of (creds ?? [])) {
    if (c.api_key) {
      integration_credentials[c.service] = {
        api_key: c.api_key,
        api_url: c.api_url ?? null,
      };
    }
  }

  return NextResponse.json({
    classrooms: classrooms ?? [],
    device_policies: {},
    feature_flags: {},
    current_packages: sitePackages.map((p: any) => ({
      id: p.id,
      name: p.name,
      manifest: p.manifest,
    })),
    schedules,
    class_group_students: classGroupStudents,
    integration_credentials,
  });
}
