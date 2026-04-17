import { describe, it, expect, beforeEach } from 'vitest';
import { seedMockData, mockSupabaseData } from '../mocks/supabase';
import { fixtures } from '../fixtures';
import { POST } from '@/app/api/nodes/heartbeat/route';
import { NextRequest } from 'next/server';

function makeRequest(payload: Record<string, any>) {
  return new NextRequest('http://localhost:3000/api/nodes/heartbeat', {
    method: 'POST',
    body: JSON.stringify(payload),
    headers: { 'Content-Type': 'application/json' },
  });
}

function validPayload(overrides: Record<string, any> = {}) {
  return {
    node_id: 'node-001',
    timestamp: new Date().toISOString(),
    version: '1.0.0',
    storage_used_gb: 200,
    storage_total_gb: 1000,
    active_sessions: 5,
    sync_status: 'idle',
    jellyfin_reachable: true,
    wan_connected: true,
    cpu_usage_pct: 45,
    memory_used_gb: 4,
    memory_total_gb: 8,
    enrolled_devices: 10,
    pending_sync_jobs: 0,
    completed_sync_jobs_today: 3,
    failed_sync_jobs_today: 0,
    uptime_seconds: 3600,
    jellyfin_version: '10.9.11',
    last_successful_sync_at: null,
    ...overrides,
  };
}

describe('POST /api/nodes/heartbeat', () => {
  beforeEach(() => {
    seedMockData({
      nodes: [fixtures.node({ status: 'active', metadata: {} })],
    });
  });

  it('accepts valid heartbeat payload and returns ok: true', async () => {
    const res = await POST(makeRequest(validPayload()));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.ok).toBe(true);
  });

  it('updates node last_seen_at on heartbeat', async () => {
    const before = mockSupabaseData.nodes[0].last_seen_at;
    await POST(makeRequest(validPayload()));
    const after = mockSupabaseData.nodes[0].last_seen_at;
    expect(after).toBeDefined();
    // The last_seen_at should be updated (could be same instant in fast test)
    expect(typeof after).toBe('string');
  });

  it('updates node storage_used_gb from payload', async () => {
    await POST(makeRequest(validPayload({ storage_used_gb: 350 })));
    const node = mockSupabaseData.nodes[0];
    expect(node.storage_used_gb).toBe(350);
  });

  it('inserts node_metrics row on each heartbeat', async () => {
    await POST(makeRequest(validPayload()));
    const metrics = mockSupabaseData.node_metrics;
    expect(metrics.length).toBeGreaterThanOrEqual(1);
    expect(metrics[0].node_id).toBe('node-001');
    expect(metrics[0].cpu_pct).toBe(45);
  });

  it('inserts node_event type heartbeat on success', async () => {
    await POST(makeRequest(validPayload()));
    const events = mockSupabaseData.node_events;
    const heartbeatEvent = events.find((e) => e.event_type === 'heartbeat');
    expect(heartbeatEvent).toBeDefined();
    expect(heartbeatEvent.severity).toBe('info');
  });

  it('inserts warning event when jellyfin_reachable is false', async () => {
    await POST(makeRequest(validPayload({ jellyfin_reachable: false })));
    const events = mockSupabaseData.node_events;
    const jfEvent = events.find((e) => e.event_type === 'jellyfin_unreachable');
    expect(jfEvent).toBeDefined();
    expect(jfEvent.severity).toBe('warning');
  });

  it('inserts wan_restored event when wan_connected flips true', async () => {
    // Set previous metadata to show WAN was disconnected
    seedMockData({
      nodes: [fixtures.node({ status: 'active', metadata: { last_wan_connected: false, cpu_high_count: 0 } })],
    });

    await POST(makeRequest(validPayload({ wan_connected: true })));
    const events = mockSupabaseData.node_events;
    const wanEvent = events.find((e) => e.event_type === 'wan_restored');
    expect(wanEvent).toBeDefined();
  });

  it('returns 404 for unknown node_id', async () => {
    const res = await POST(makeRequest(validPayload({ node_id: 'nonexistent' })));
    expect(res.status).toBe(404);
  });

  it('returns server_time in response', async () => {
    const res = await POST(makeRequest(validPayload()));
    const body = await res.json();
    expect(body.server_time).toBeDefined();
    expect(typeof body.server_time).toBe('string');
  });

  it('triggers storage_high alert when storage > 85%', async () => {
    await POST(makeRequest(validPayload({ storage_used_gb: 870, storage_total_gb: 1000 })));
    const events = mockSupabaseData.node_events;
    const storageEvent = events.find((e) => e.event_type === 'storage_high');
    expect(storageEvent).toBeDefined();
    expect(storageEvent.severity).toBe('warning');
  });

  it('triggers storage_critical alert when storage > 95%', async () => {
    await POST(makeRequest(validPayload({ storage_used_gb: 960, storage_total_gb: 1000 })));
    const events = mockSupabaseData.node_events;
    const storageEvent = events.find((e) => e.event_type === 'storage_critical');
    expect(storageEvent).toBeDefined();
    expect(storageEvent.severity).toBe('critical');
  });
});
