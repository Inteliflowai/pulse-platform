import { NextRequest, NextResponse } from 'next/server';
import { createAdminSupabaseClient } from '@/lib/supabase/admin';
import { createSupabaseServerClient } from '@/lib/supabase/server';

// Bulk operations: assign sequences, enroll devices, revoke devices
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { action, ids, target_id, data } = body;

    const supabase = await createSupabaseServerClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const admin = createAdminSupabaseClient();
    let affected = 0;

    switch (action) {
      case 'revoke_devices': {
        for (const id of ids ?? []) {
          const { error } = await admin.from('devices').update({ status: 'revoked' }).eq('id', id);
          if (!error) affected++;
        }
        break;
      }

      case 'assign_sequence': {
        // Assign a sequence to multiple class groups
        const { sequence_id, class_group_ids } = data ?? {};
        for (const cgId of class_group_ids ?? []) {
          const { error } = await admin.from('class_group_sequences').upsert(
            { class_group_id: cgId, sequence_id, status: 'active' },
            { onConflict: 'class_group_id,sequence_id' }
          );
          if (!error) affected++;
        }
        break;
      }

      case 'publish_packages': {
        for (const id of ids ?? []) {
          const { error } = await admin.from('packages').update({ status: 'published' }).eq('id', id);
          if (!error) affected++;
        }
        break;
      }

      case 'sync_packages': {
        // Push sync for multiple packages
        for (const pkgId of ids ?? []) {
          const res = await fetch(`${request.nextUrl.origin}/api/sync/enqueue`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ package_id: pkgId }),
          });
          if (res.ok) affected++;
        }
        break;
      }

      default:
        return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
    }

    return NextResponse.json({ ok: true, affected });
  } catch {
    return NextResponse.json({ error: 'Invalid request' }, { status: 400 });
  }
}
