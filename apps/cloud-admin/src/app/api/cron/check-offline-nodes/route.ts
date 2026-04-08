import { NextRequest, NextResponse } from 'next/server';
import { createAdminSupabaseClient } from '@/lib/supabase/admin';

export async function GET(request: NextRequest) {
  const secret = request.headers.get('x-cron-secret');
  if (!secret || secret !== process.env.SUPABASE_SERVICE_ROLE_KEY) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const supabase = createAdminSupabaseClient();
  const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000).toISOString();

  // Find active nodes that haven't sent a heartbeat in 5 minutes
  const { data: staleNodes } = await supabase
    .from('nodes')
    .select('id, name, last_seen_at')
    .eq('status', 'active')
    .lt('last_seen_at', fiveMinutesAgo);

  let marked = 0;
  for (const node of staleNodes ?? []) {
    await supabase.from('nodes').update({ status: 'offline' }).eq('id', node.id);
    await supabase.from('node_events').insert({
      node_id: node.id,
      event_type: 'node_offline',
      severity: 'warning',
      message: `Node marked offline — no heartbeat since ${node.last_seen_at}`,
    });
    marked++;
  }

  return NextResponse.json({ checked: (staleNodes ?? []).length, marked_offline: marked });
}
