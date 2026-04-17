import { describe, it, expect, beforeEach } from 'vitest';
import { seedMockData, mockSupabaseData } from '../mocks/supabase';
import { fixtures } from '../fixtures';
import { POST } from '@/app/api/nodes/register/route';
import { NextRequest } from 'next/server';

function makeRequest(body: Record<string, any>) {
  return new NextRequest('http://localhost:3000/api/nodes/register', {
    method: 'POST',
    body: JSON.stringify(body),
    headers: { 'Content-Type': 'application/json' },
  });
}

describe('POST /api/nodes/register', () => {
  beforeEach(() => {
    seedMockData({
      nodes: [fixtures.node({ status: 'pending', registration_token: 'valid-token-123' })],
    });
  });

  it('registers a pending node with valid token', async () => {
    const res = await POST(makeRequest({
      registration_token: 'valid-token-123',
      hostname: 'school-server',
      version: '1.0.0',
      ip_address: '10.0.0.5',
      storage_total_gb: 500,
    }));

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.node_id).toBe('node-001');
  });

  it('returns node_id, site_id, tenant_id on success', async () => {
    const res = await POST(makeRequest({
      registration_token: 'valid-token-123',
      hostname: 'school-server',
      version: '1.0.0',
      ip_address: '10.0.0.5',
      storage_total_gb: 500,
    }));

    const body = await res.json();
    expect(body.node_id).toBe('node-001');
    expect(body.site_id).toBe('site-001');
    expect(body.tenant_id).toBe('tenant-001');
  });

  it('returns 404 when registration_token not found', async () => {
    const res = await POST(makeRequest({
      registration_token: 'invalid-token',
      hostname: 'server',
      version: '1.0.0',
      ip_address: '10.0.0.5',
      storage_total_gb: 500,
    }));

    expect(res.status).toBe(404);
    const body = await res.json();
    expect(body.error).toContain('not found');
  });

  it('returns 409 when node already registered (status active)', async () => {
    seedMockData({
      nodes: [fixtures.node({ status: 'active', registration_token: 'active-token' })],
    });

    const res = await POST(makeRequest({
      registration_token: 'active-token',
      hostname: 'server',
      version: '1.0.0',
      ip_address: '10.0.0.5',
      storage_total_gb: 500,
    }));

    expect(res.status).toBe(409);
    const body = await res.json();
    expect(body.error).toContain('already registered');
  });

  it('returns 400 when required fields missing (hostname)', async () => {
    const res = await POST(makeRequest({
      registration_token: 'valid-token-123',
      version: '1.0.0',
      ip_address: '10.0.0.5',
      storage_total_gb: 500,
    }));

    expect(res.status).toBe(400);
  });

  it('returns 400 when required fields missing (version)', async () => {
    const res = await POST(makeRequest({
      registration_token: 'valid-token-123',
      hostname: 'server',
      ip_address: '10.0.0.5',
      storage_total_gb: 500,
    }));

    expect(res.status).toBe(400);
  });

  it('writes audit_log entry on successful registration', async () => {
    await POST(makeRequest({
      registration_token: 'valid-token-123',
      hostname: 'school-server',
      version: '1.0.0',
      ip_address: '10.0.0.5',
      storage_total_gb: 500,
    }));

    const auditLogs = mockSupabaseData.audit_logs;
    expect(auditLogs.length).toBeGreaterThanOrEqual(1);
    const log = auditLogs.find((l) => l.event_type === 'node_registered');
    expect(log).toBeDefined();
    expect(log.entity_type).toBe('node');
  });

  it('updates node status to active on success', async () => {
    await POST(makeRequest({
      registration_token: 'valid-token-123',
      hostname: 'school-server',
      version: '1.0.0',
      ip_address: '10.0.0.5',
      storage_total_gb: 500,
    }));

    const node = mockSupabaseData.nodes[0];
    expect(node.status).toBe('active');
  });

  it('sets registered_at timestamp on success', async () => {
    await POST(makeRequest({
      registration_token: 'valid-token-123',
      hostname: 'school-server',
      version: '1.0.0',
      ip_address: '10.0.0.5',
      storage_total_gb: 500,
    }));

    const node = mockSupabaseData.nodes[0];
    expect(node.registered_at).toBeDefined();
  });
});
