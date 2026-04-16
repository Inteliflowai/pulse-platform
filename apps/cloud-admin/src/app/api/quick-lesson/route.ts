import { NextRequest, NextResponse } from 'next/server';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { createAdminSupabaseClient } from '@/lib/supabase/admin';

/**
 * POST /api/quick-lesson
 * 3-step quick lesson flow: creates package, schedule, and optionally triggers quiz generation.
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const {
      asset_id, title, subject, grade_band, class_group_id,
      classroom_id, scheduled_date, scheduled_time,
      duration_minutes, lesson_plan_text, generate_quiz,
    } = body;

    if (!asset_id || !title || !class_group_id || !classroom_id || !scheduled_time) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
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

    const admin = createAdminSupabaseClient();

    // 1. Find or create package containing this asset
    const { data: existingPkgAsset } = await admin
      .from('package_assets')
      .select('package_id')
      .eq('asset_id', asset_id)
      .limit(1)
      .single();

    let packageId: string;

    if (existingPkgAsset) {
      packageId = existingPkgAsset.package_id;
      // Ensure package is published
      await admin.from('packages').update({ status: 'published' }).eq('id', packageId);
    } else {
      // Create new package
      const { data: newPkg, error: pkgErr } = await admin
        .from('packages')
        .insert({
          tenant_id: profile.tenant_id,
          created_by: user.id,
          name: `Quick: ${title}`,
          version: '1.0.0',
          status: 'published',
          target_sites: profile.site_id ? [profile.site_id] : [],
          total_size_bytes: 0,
        })
        .select('id')
        .single();

      if (pkgErr || !newPkg) {
        return NextResponse.json({ error: 'Failed to create package' }, { status: 500 });
      }
      packageId = newPkg.id;

      // Add asset to package
      await admin.from('package_assets').insert({
        package_id: packageId,
        asset_id,
        sort_order: 0,
      });
    }

    // 2. Create learning sequence
    const { data: seq, error: seqErr } = await admin
      .from('learning_sequences')
      .insert({
        tenant_id: profile.tenant_id,
        name: title,
        description: subject ? `${subject} — ${grade_band ?? ''}` : null,
        package_id: packageId,
        created_by: user.id,
        status: 'published',
      })
      .select('id')
      .single();

    if (seqErr || !seq) {
      return NextResponse.json({ error: 'Failed to create sequence' }, { status: 500 });
    }

    // Add video item to sequence
    await admin.from('sequence_items').insert({
      sequence_id: seq.id,
      sort_order: 0,
      item_type: 'video',
      title,
      asset_id,
      auto_advance: true,
      require_completion: true,
    });

    // 3. Push sync job to the classroom's node
    const { data: classroom } = await admin
      .from('classrooms')
      .select('node_id, site_id')
      .eq('id', classroom_id)
      .single();

    let syncJobId: string | null = null;
    if (classroom?.node_id) {
      const { data: syncJob } = await admin
        .from('sync_jobs')
        .insert({
          package_id: packageId,
          node_id: classroom.node_id,
          status: 'pending',
          progress_pct: 0,
          bytes_transferred: 0,
          bytes_total: 0,
          retries: 0,
        })
        .select('id')
        .single();
      syncJobId = syncJob?.id ?? null;
    }

    // 4. Create classroom_schedule record
    const { data: schedule, error: schedErr } = await admin
      .from('classroom_schedules')
      .insert({
        classroom_id,
        class_group_id,
        sequence_id: seq.id,
        teacher_id: user.id,
        site_id: classroom?.site_id ?? profile.site_id,
        tenant_id: profile.tenant_id,
        scheduled_date: scheduled_date || null,
        scheduled_time: scheduled_time,
        duration_minutes: duration_minutes ?? 60,
        recurrence: 'once',
        status: 'scheduled',
      })
      .select('id')
      .single();

    if (schedErr) {
      return NextResponse.json({ error: 'Failed to create schedule' }, { status: 500 });
    }

    // 5. Quiz generation (async — don't block)
    let quizStatus = 'skipped';
    if (generate_quiz && lesson_plan_text) {
      quizStatus = 'pending';
      // Fire and forget — quiz generation happens asynchronously
      // In production, this would call the CORE API to generate questions
    }

    return NextResponse.json({
      schedule_id: schedule?.id,
      sequence_id: seq.id,
      sync_job_id: syncJobId,
      quiz_generation_status: quizStatus,
    }, { status: 201 });
  } catch {
    return NextResponse.json({ error: 'Invalid request' }, { status: 400 });
  }
}
