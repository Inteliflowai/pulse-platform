import { NextRequest, NextResponse } from 'next/server';
import { createAdminSupabaseClient } from '@/lib/supabase/admin';
import { requireNodeToken } from '@/lib/node-auth';

// POST — sync student progress and quiz results from node to cloud
export async function POST(request: NextRequest) {
  try {
    const auth = await requireNodeToken(request);
    if (!auth.ok) return auth.response;

    const body = await request.json();
    const { progress_records, quiz_attempts } = body;

    const supabase = createAdminSupabaseClient();

    // Tenant-scope every incoming row to the authenticated node's tenant so
    // a compromised node can't write rows into another tenant.
    const tid = auth.node.tenant_id;

    if (progress_records && Array.isArray(progress_records)) {
      for (const record of progress_records) {
        await supabase.from('student_progress').upsert({ ...record, tenant_id: tid }, { onConflict: 'id' });
      }
    }

    if (quiz_attempts && Array.isArray(quiz_attempts)) {
      for (const attempt of quiz_attempts) {
        const { responses, ...attemptData } = attempt;

        await supabase.from('quiz_attempts').upsert(
          { ...attemptData, tenant_id: tid, synced_to_cloud: true },
          { onConflict: 'id' }
        );

        if (responses && Array.isArray(responses)) {
          for (const resp of responses) {
            await supabase.from('quiz_responses').upsert({ ...resp, tenant_id: tid }, { onConflict: 'id' });
          }
        }
      }
    }

    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ error: 'Invalid request' }, { status: 400 });
  }
}
