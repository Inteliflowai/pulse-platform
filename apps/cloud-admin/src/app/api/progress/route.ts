import { NextRequest, NextResponse } from 'next/server';
import { createAdminSupabaseClient } from '@/lib/supabase/admin';

// POST — sync student progress and quiz results from node to cloud
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { progress_records, quiz_attempts } = body;

    const supabase = createAdminSupabaseClient();

    // Sync progress records
    if (progress_records && Array.isArray(progress_records)) {
      for (const record of progress_records) {
        await supabase.from('student_progress').upsert(record, { onConflict: 'id' });
      }
    }

    // Sync quiz attempts and responses
    if (quiz_attempts && Array.isArray(quiz_attempts)) {
      for (const attempt of quiz_attempts) {
        const { responses, ...attemptData } = attempt;

        await supabase.from('quiz_attempts').upsert(
          { ...attemptData, synced_to_cloud: true },
          { onConflict: 'id' }
        );

        if (responses && Array.isArray(responses)) {
          for (const resp of responses) {
            await supabase.from('quiz_responses').upsert(resp, { onConflict: 'id' });
          }
        }
      }
    }

    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ error: 'Invalid request' }, { status: 400 });
  }
}
