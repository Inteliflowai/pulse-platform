import { NextRequest, NextResponse } from 'next/server';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { createAdminSupabaseClient } from '@/lib/supabase/admin';
import { hasLicense, isLicenseUsable } from '@/lib/licenses';

/**
 * POST /api/class-groups/import-from-core
 * Import class groups and students from CORE.
 *
 * Body: { core_api_url, core_session_token, class_ids?: string[] }
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { core_api_url, core_session_token, class_ids } = body;

    if (!core_api_url || !core_session_token) {
      return NextResponse.json({ error: 'Missing core_api_url or core_session_token' }, { status: 400 });
    }

    const supabase = await createSupabaseServerClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { data: profile } = await supabase
      .from('users')
      .select('tenant_id, site_id')
      .eq('id', user.id)
      .single();
    if (!profile) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    // License gate: CORE integration requires an active CORE license.
    const admin0 = createAdminSupabaseClient();
    const licState = await hasLicense(admin0, profile.tenant_id, 'core');
    if (!isLicenseUsable(licState)) {
      return NextResponse.json({
        error: 'CORE is not licensed for this tenant',
        license_state: licState,
      }, { status: 402 });
    }

    // Fetch classes from CORE
    const coreRes = await fetch(`${core_api_url}/api/pulse/export-classes`, {
      headers: {
        'Authorization': `Bearer ${core_session_token}`,
        'Content-Type': 'application/json',
      },
      signal: AbortSignal.timeout(15_000),
    });

    if (!coreRes.ok) {
      return NextResponse.json({ error: 'Failed to fetch classes from CORE' }, { status: 502 });
    }

    const coreData = await coreRes.json() as any;
    let classes: any[] = coreData.classes ?? coreData ?? [];

    // Filter to requested class IDs if provided
    if (class_ids && class_ids.length > 0) {
      classes = classes.filter((c: any) => class_ids.includes(c.id));
    }

    const admin = createAdminSupabaseClient();
    let imported = 0;
    let updated = 0;

    for (const cls of classes) {
      // Find or match the grade
      let gradeId: string | null = null;
      if (cls.grade) {
        const { data: grade } = await admin
          .from('grades')
          .select('id')
          .eq('tenant_id', profile.tenant_id)
          .ilike('name', cls.grade)
          .limit(1)
          .single();
        gradeId = grade?.id ?? null;
      }

      // Find or match the subject
      let subjectId: string | null = null;
      if (cls.subject) {
        const { data: subject } = await admin
          .from('subjects')
          .select('id')
          .eq('tenant_id', profile.tenant_id)
          .ilike('name', cls.subject)
          .limit(1)
          .single();
        subjectId = subject?.id ?? null;
      }

      if (!gradeId || !subjectId) continue;

      // Upsert class group
      const { data: existing } = await admin
        .from('class_groups')
        .select('id')
        .eq('tenant_id', profile.tenant_id)
        .eq('name', cls.name)
        .eq('grade_id', gradeId)
        .eq('subject_id', subjectId)
        .limit(1)
        .single();

      let classGroupId: string;

      // CORE's new export-classes response uses core_class_id as the
      // canonical key; older responses used cls.id. Accept either.
      const coreClassId: string = cls.core_class_id ?? cls.id;

      if (existing) {
        // Update existing
        await admin
          .from('class_groups')
          .update({
            teacher_id: cls.teacher_id || null,
            core_class_id: coreClassId,
            metadata: { core_class_id: coreClassId, imported_from: 'core' },
          })
          .eq('id', existing.id);
        classGroupId = existing.id;
        updated++;
      } else {
        // Create new
        const { data: newGroup, error } = await admin
          .from('class_groups')
          .insert({
            tenant_id: profile.tenant_id,
            site_id: profile.site_id,
            grade_id: gradeId,
            subject_id: subjectId,
            name: cls.name,
            teacher_id: cls.teacher_id || user.id,
            status: 'active',
            core_class_id: coreClassId,
            metadata: { core_class_id: coreClassId, imported_from: 'core' },
          })
          .select('id')
          .single();

        if (error || !newGroup) continue;
        classGroupId = newGroup.id;
        imported++;
      }

      // Import students
      const students: any[] = cls.students ?? [];
      for (const student of students) {
        // Find or create student profile
        const { data: existingStudent } = await admin
          .from('student_profiles')
          .select('id, user_id')
          .eq('tenant_id', profile.tenant_id)
          .eq('student_number', student.student_number ?? student.id)
          .limit(1)
          .single();

        if (existingStudent) {
          // Enroll in class group if not already
          await admin
            .from('class_group_students')
            .upsert({
              class_group_id: classGroupId,
              student_id: existingStudent.user_id ?? existingStudent.id,
              status: 'active',
            }, { onConflict: 'class_group_id,student_id' })
            .select();
        }
      }
    }

    return NextResponse.json({ imported, updated, total: classes.length });
  } catch (err: any) {
    return NextResponse.json({ error: err.message ?? 'Import failed' }, { status: 500 });
  }
}
