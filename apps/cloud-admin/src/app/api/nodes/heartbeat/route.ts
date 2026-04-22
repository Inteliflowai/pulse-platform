import { NextRequest, NextResponse } from 'next/server';
import { createAdminSupabaseClient } from '@/lib/supabase/admin';
import type { HeartbeatPayload } from '@pulse/shared';
import { dispatchAlert } from '@/lib/alerts/dispatcher';
import { requireNodeToken } from '@/lib/node-auth';

export async function POST(request: NextRequest) {
  try {
    const payload: HeartbeatPayload = await request.json();
    const { node_id, version, storage_used_gb, storage_total_gb, jellyfin_reachable, wan_connected, cpu_usage_pct, memory_used_gb, memory_total_gb, active_sessions, enrolled_devices, pending_sync_jobs } = payload;

    if (!node_id) {
      return NextResponse.json({ error: 'Missing node_id' }, { status: 400 });
    }

    // Authenticate: token must match the node_id in the payload.
    const auth = await requireNodeToken(request, { expectedNodeId: node_id });
    if (!auth.ok) return auth.response;

    const supabase = createAdminSupabaseClient();

    // Re-fetch for metadata. We already know status is active (requireNodeToken enforces).
    const { data: node } = await supabase
      .from('nodes')
      .select('id, status, tenant_id, metadata')
      .eq('id', node_id)
      .single();

    if (!node) {
      return NextResponse.json({ error: 'Node not found' }, { status: 404 });
    }

    const now = new Date().toISOString();
    const prevMeta = (node.metadata as any) ?? {};
    const tenantId = node.tenant_id;

    // Update node
    await supabase
      .from('nodes')
      .update({
        last_seen_at: now,
        storage_used_gb,
        storage_total_gb,
        version,
        metadata: { ...prevMeta, last_wan_connected: wan_connected, cpu_high_count: prevMeta.cpu_high_count ?? 0, enrolled_devices: enrolled_devices ?? 0 },
      })
      .eq('id', node_id);

    // Insert node_metrics
    await supabase.from('node_metrics').insert({
      node_id,
      cpu_pct: cpu_usage_pct ?? 0,
      memory_used_gb: memory_used_gb ?? 0,
      memory_total_gb: memory_total_gb ?? 0,
      storage_used_gb: storage_used_gb ?? 0,
      storage_total_gb: storage_total_gb ?? 0,
      active_sessions: active_sessions ?? 0,
      enrolled_devices: enrolled_devices ?? 0,
      pending_sync_jobs: pending_sync_jobs ?? 0,
      wan_connected: wan_connected ?? true,
      jellyfin_reachable: jellyfin_reachable ?? true,
    });

    // Insert heartbeat event
    await supabase.from('node_events').insert({
      node_id,
      event_type: 'heartbeat',
      severity: 'info',
      message: 'Heartbeat received',
      metadata: payload as any,
    });

    // ── Alert detection (dispatch runs async — never blocks response) ──

    // WAN state change
    if (wan_connected && prevMeta.last_wan_connected === false) {
      await supabase.from('node_events').insert({ node_id, event_type: 'wan_restored', severity: 'info', message: 'WAN connectivity restored' });
    }

    // Jellyfin unreachable
    if (!jellyfin_reachable) {
      await supabase.from('node_events').insert({ node_id, event_type: 'jellyfin_unreachable', severity: 'warning', message: 'Jellyfin is not reachable from the node' });
      // Dispatch alert async
      dispatchAlert({ tenant_id: tenantId, node_id, alert_type: 'jellyfin_unreachable', severity: 'warning', message: 'Jellyfin is not reachable from the node' }).catch(() => {});
    }

    // Storage alerts
    if (storage_total_gb && storage_total_gb > 0) {
      const storagePct = storage_used_gb / storage_total_gb;
      if (storagePct > 0.95) {
        await supabase.from('node_events').insert({ node_id, event_type: 'storage_critical', severity: 'critical', message: `Storage at ${(storagePct * 100).toFixed(0)}%` });
        dispatchAlert({ tenant_id: tenantId, node_id, alert_type: 'storage_critical', severity: 'critical', message: `Storage at ${(storagePct * 100).toFixed(0)}%` }).catch(() => {});
      } else if (storagePct > 0.85) {
        await supabase.from('node_events').insert({ node_id, event_type: 'storage_high', severity: 'warning', message: `Storage at ${(storagePct * 100).toFixed(0)}%` });
        dispatchAlert({ tenant_id: tenantId, node_id, alert_type: 'storage_high', severity: 'warning', message: `Storage at ${(storagePct * 100).toFixed(0)}%` }).catch(() => {});
      }
    }

    // CPU sustained high (3 consecutive heartbeats > 90%)
    const cpuHighCount = (cpu_usage_pct ?? 0) > 90 ? (prevMeta.cpu_high_count ?? 0) + 1 : 0;
    await supabase.from('nodes').update({ metadata: { ...prevMeta, last_wan_connected: wan_connected, cpu_high_count: cpuHighCount, enrolled_devices: enrolled_devices ?? 0 } }).eq('id', node_id);

    if (cpuHighCount >= 3) {
      await supabase.from('node_events').insert({ node_id, event_type: 'cpu_sustained_high', severity: 'warning', message: `CPU above 90% for ${cpuHighCount} consecutive heartbeats` });
    }

    return NextResponse.json({ ok: true, server_time: now });
  } catch {
    return NextResponse.json({ error: 'Invalid request body' }, { status: 400 });
  }
}
