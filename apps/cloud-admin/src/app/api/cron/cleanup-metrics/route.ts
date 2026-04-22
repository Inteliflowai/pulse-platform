import { NextRequest, NextResponse } from 'next/server';
import { createAdminSupabaseClient } from '@/lib/supabase/admin';
import { isCronAuthorized } from '@/lib/cron-auth';

export async function GET(request: NextRequest) {
  if (!isCronAuthorized(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const supabase = createAdminSupabaseClient();
  const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();

  // Clean up old node_metrics
  const { error: e1 } = await supabase
    .from('node_metrics')
    .delete()
    .lt('recorded_at', thirtyDaysAgo);

  // Clean up old heartbeat events (keep warnings/errors longer)
  const { error: e2 } = await supabase
    .from('node_events')
    .delete()
    .eq('event_type', 'heartbeat')
    .lt('created_at', thirtyDaysAgo);

  // Clean up read notifications older than 30 days
  const { error: e3 } = await supabase
    .from('notifications')
    .delete()
    .eq('read', true)
    .lt('created_at', thirtyDaysAgo);

  return NextResponse.json({
    ok: !e1 && !e2 && !e3,
    errors: [e1?.message, e2?.message, e3?.message].filter(Boolean),
  });
}
