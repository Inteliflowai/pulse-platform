import { NextRequest, NextResponse } from 'next/server';
import { createAdminSupabaseClient } from '@/lib/supabase/admin';

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ nodeId: string }> }
) {
  try {
    const { nodeId } = await params;
    const body = await request.json();
    const { events } = body;

    if (!Array.isArray(events) || events.length === 0) {
      return NextResponse.json({ error: 'events must be a non-empty array' }, { status: 400 });
    }

    const supabase = createAdminSupabaseClient();

    // Validate node exists
    const { data: node } = await supabase
      .from('nodes')
      .select('id')
      .eq('id', nodeId)
      .single();

    if (!node) {
      return NextResponse.json({ error: 'Node not found' }, { status: 404 });
    }

    // Batch insert events
    const rows = events.map((e: any) => ({
      node_id: nodeId,
      event_type: e.event_type,
      severity: e.severity ?? 'info',
      message: e.message ?? null,
      metadata: e.metadata ?? {},
    }));

    const { error: insertError } = await supabase.from('node_events').insert(rows);

    if (insertError) {
      return NextResponse.json({ error: 'Failed to insert events' }, { status: 500 });
    }

    return NextResponse.json({ inserted: rows.length });
  } catch {
    return NextResponse.json({ error: 'Invalid request body' }, { status: 400 });
  }
}
