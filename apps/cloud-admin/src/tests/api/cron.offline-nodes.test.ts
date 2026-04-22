import { describe, it, expect, beforeEach } from 'vitest';
import { seedMockData, mockSupabaseData } from '../mocks/supabase';
import { fixtures } from '../fixtures';
import { GET } from '@/app/api/cron/check-offline-nodes/route';
import { NextRequest } from 'next/server';

function makeRequest(headers: Record<string, string> = {}) {
  return new NextRequest('http://localhost:3000/api/cron/check-offline-nodes', {
    method: 'GET',
    headers,
  });
}

describe('GET /api/cron/check-offline-nodes', () => {
  it('marks nodes offline when last_seen_at > 5 minutes ago', async () => {
    const tenMinutesAgo = new Date(Date.now() - 10 * 60 * 1000).toISOString();
    seedMockData({
      nodes: [fixtures.node({ status: 'active', last_seen_at: tenMinutesAgo })],
    });

    const res = await GET(makeRequest({ 'x-cron-secret': 'test-cron-secret' }));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.marked_offline).toBe(1);

    const node = mockSupabaseData.nodes[0];
    expect(node.status).toBe('offline');
  });

  it('does not mark recently-seen nodes offline', async () => {
    const oneMinuteAgo = new Date(Date.now() - 1 * 60 * 1000).toISOString();
    seedMockData({
      nodes: [fixtures.node({ status: 'active', last_seen_at: oneMinuteAgo })],
    });

    const res = await GET(makeRequest({ 'x-cron-secret': 'test-cron-secret' }));
    const body = await res.json();
    expect(body.marked_offline).toBe(0);

    const node = mockSupabaseData.nodes[0];
    expect(node.status).toBe('active');
  });

  it('inserts node_event for each newly offline node', async () => {
    const tenMinutesAgo = new Date(Date.now() - 10 * 60 * 1000).toISOString();
    seedMockData({
      nodes: [fixtures.node({ status: 'active', last_seen_at: tenMinutesAgo })],
    });

    await GET(makeRequest({ 'x-cron-secret': 'test-cron-secret' }));

    const events = mockSupabaseData.node_events;
    const offlineEvent = events.find((e) => e.event_type === 'node_offline');
    expect(offlineEvent).toBeDefined();
    expect(offlineEvent.severity).toBe('warning');
  });

  it('requires cron secret header', async () => {
    const res = await GET(makeRequest());
    expect(res.status).toBe(401);
  });

  it('returns count of nodes marked offline', async () => {
    const tenMinutesAgo = new Date(Date.now() - 10 * 60 * 1000).toISOString();
    seedMockData({
      nodes: [
        fixtures.node({ id: 'node-001', status: 'active', last_seen_at: tenMinutesAgo }),
        fixtures.node({ id: 'node-002', status: 'active', last_seen_at: tenMinutesAgo }),
      ],
    });

    const res = await GET(makeRequest({ 'x-cron-secret': 'test-cron-secret' }));
    const body = await res.json();
    expect(body.marked_offline).toBe(2);
    expect(body.checked).toBe(2);
  });
});
