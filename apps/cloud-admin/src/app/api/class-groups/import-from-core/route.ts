import { NextRequest, NextResponse } from 'next/server';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { createAdminSupabaseClient } from '@/lib/supabase/admin';
import { hasLicense, isLicenseUsable } from '@/lib/licenses';

const CORE_API_URL_DEFAULT = process.env.CORE_API_URL ?? 'https://app.inteliflowai.com';

/**
 * POST /api/class-groups/import-from-core
 * Import class groups and students from CORE using the per-tenant cached
 * Bearer key (provisioned via /api/admin/platform-keys when the CORE license
 * was created). The previous contract asked the caller to pass a session
 * token in the body — that's been removed; tenant_integration_credentials
 * is the single source of truth.
 *
 * Body: { tenant_id?: string (super_admin only), class_ids?: string[] }
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => ({}));
    const { class_ids, tenant_id: explicitTenantId } = body;

    const supabase = await createSupabaseServerClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { data: profile } = await supabase
      .from('users')
      .select('tenant_id, site_id, role')
      .eq('id', user.id)
      .single();
    if (!profile) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    // Super-admins can act on behalf of any tenant; everyone else gets their own.
    const targetTenantId = (profile.role === 'super_admin' && explicitTenantId)
      ? explicitTenantId
      : profile.tenant_id;

    const admin0 = createAdminSupabaseClient();
    const licState = await hasLicense(admin0, targetTenantId, 'core');
    if (!isLicenseUsable(licState)) {
      return NextResponse.json({
        error: 'CORE is not licensed for this tenant',
        license_state: licState,
      }, { status: 402 });
    }

    // Resolve the per-tenant CORE Bearer from cached credentials.
    const { data: cred } = await admin0
      .from('tenant_integration_credentials')
      .select('api_key, api_url, status')
      .eq('tenant_id', targetTenantId)
      .eq('service', 'core')
      .maybeSingle();

    if (!cred?.api_key || cred.status !== 'active') {
      return NextResponse.json({
        error: 'No active CORE Bearer key for this tenant. Provision a CORE license first.',
      }, { status: 412 });
    }

    const coreApiUrl = cred.api_url || CORE_API_URL_DEFAULT;
    const coreRes = await fetch(`${coreApiUrl}/api/attempts/pulse/export-classes`, {
      headers: {
        'Authorization': `Bearer ${cred.api_key}`,
        'Content-Type': 'application/json',
      },
      signal: AbortSignal.timeout(15_000),
    });

    if (!coreRes.ok) {
      return NextResponse.json({
        error: 'CORE rejected the export request',
        http_status: coreRes.status,
      }, { status: coreRes.status === 401 || coreRes.status === 403 ? 502 : 502 });
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
          .eq('tenant_id', targetTenantId)
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
          .eq('tenant_id', targetTenantId)
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
        .eq('tenant_id', targetTenantId)
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
            tenant_id: targetTenantId,
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
          .eq('tenant_id', targetTenantId)
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
