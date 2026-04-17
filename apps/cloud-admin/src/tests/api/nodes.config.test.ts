import { describe, it, expect, beforeEach } from 'vitest';
import { seedMockData } from '../mocks/supabase';
import { fixtures } from '../fixtures';
import { GET } from '@/app/api/nodes/[nodeId]/config/route';
import { NextRequest } from 'next/server';

const params = (nodeId: string) => Promise.resolve({ nodeId });

function makeRequest(nodeId: string, headers: Record<string, string> = {}) {
  return new NextRequest(`http://localhost:3000/api/nodes/${nodeId}/config`, {
    method: 'GET',
    headers,
  });
}

describe('GET /api/nodes/[nodeId]/config', () => {
  beforeEach(() => {
    seedMockData({
      nodes: [fixtures.node({ id: 'node-001', site_id: 'site-001', tenant_id: 'tenant-001' })],
      classrooms: [fixtures.classroom({ node_id: 'node-001' })],
      packages: [fixtures.package({ status: 'published', tenant_id: 'tenant-001' })],
    });
  });

  it('returns classrooms array for node', async () => {
    const res = await GET(
      makeRequest('node-001', { 'x-node-secret': 'test-service-role-key' }),
      { params: params('node-001') }
    );
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(Array.isArray(body.classrooms)).toBe(true);
    expect(body.classrooms.length).toBeGreaterThanOrEqual(1);
  });

  it('returns feature_flags object', async () => {
    const res = await GET(
      makeRequest('node-001', { 'x-node-secret': 'test-service-role-key' }),
      { params: params('node-001') }
    );
    const body = await res.json();
    expect(body.feature_flags).toBeDefined();
    expect(typeof body.feature_flags).toBe('object');
  });

  it('returns current_packages manifest refs', async () => {
    const res = await GET(
      makeRequest('node-001', { 'x-node-secret': 'test-service-role-key' }),
      { params: params('node-001') }
    );
    const body = await res.json();
    expect(Array.isArray(body.current_packages)).toBe(true);
  });

  it('returns 404 for unknown node_id', async () => {
    const res = await GET(
      makeRequest('nonexistent', { 'x-node-secret': 'test-service-role-key' }),
      { params: params('nonexistent') }
    );
    expect(res.status).toBe(404);
  });

  it('requires valid node token in header', async () => {
    const res = await GET(
      makeRequest('node-001', { 'x-node-secret': 'wrong-secret' }),
      { params: params('node-001') }
    );
    expect(res.status).toBe(401);
  });

  it('rejects request with no auth header', async () => {
    const res = await GET(
      makeRequest('node-001'),
      { params: params('node-001') }
    );
    expect(res.status).toBe(401);
  });
});
