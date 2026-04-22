/**
 * Tests for the CORE credential provisioning flow wired into the license
 * lifecycle. We mock fetch so no real CORE is contacted — the contract
 * under test is Pulse's side of the handshake + database state.
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { seedMockData, mockSupabaseData } from '../mocks/supabase';
import { fixtures } from '../fixtures';
import { POST as provisionPOST } from '@/app/api/licenses/route';
import { DELETE as licenseDELETE } from '@/app/api/licenses/[id]/route';
import { GET as nodeConfigGET } from '@/app/api/nodes/[nodeId]/config/route';
import { NextRequest } from 'next/server';

function post(url: string, body: any) {
  return new NextRequest(url, {
    method: 'POST',
    body: JSON.stringify(body),
    headers: { 'Content-Type': 'application/json' },
  });
}

function del(url: string) {
  return new NextRequest(url, { method: 'DELETE' });
}

function get(url: string, headers: Record<string, string> = {}) {
  return new NextRequest(url, { method: 'GET', headers });
}

function mockCoreFetch(handler: (url: string, init: RequestInit | undefined) => Promise<Response> | Response) {
  return vi.spyOn(globalThis, 'fetch').mockImplementation(async (input: any, init?: any) => {
    const url = typeof input === 'string' ? input : input.url;
    return handler(url, init);
  });
}

describe('POST /api/licenses with product=core — CORE credential flow', () => {
  beforeEach(() => {
    seedMockData({
      users: [{ id: 'mock-user-id', role: 'super_admin', email: 'ops@inteliflowai.com', tenant_id: 'tenant-A' } as any],
      tenants: [fixtures.tenant({ id: 'tenant-A', name: 'Greenfield Academy' })],
    });
    process.env.CORE_PROVISIONING_SECRET = 'test-provisioning-secret';
    process.env.CORE_API_URL = 'https://app.inteliflowai.com';
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('provisions a CORE credential on license creation and stores the returned api_key', async () => {
    const fetchSpy = mockCoreFetch(async (url) => {
      if (url.endsWith('/api/admin/platform-keys') && !url.includes('?')) {
        return new Response(JSON.stringify({
          ok: true,
          id: 'core-row-1',
          api_key: 'core_pulse_abc123',
          product: 'pulse',
          school_id: 'tenant-A',
          label: null,
          is_active: true,
          created_at: '2026-04-22T00:00:00Z',
        }), { status: 201 });
      }
      return new Response('unexpected url: ' + url, { status: 500 });
    });

    const res = await provisionPOST(post('http://localhost/api/licenses', {
      tenant_id: 'tenant-A', product: 'core', plan: 'professional',
    }));
    expect(res.status).toBe(201);
    const body = await res.json();
    expect(body.credential?.status).toBe('active');

    const cred = mockSupabaseData.tenant_integration_credentials.find((c) => c.tenant_id === 'tenant-A' && c.service === 'core');
    expect(cred).toBeDefined();
    expect(cred.api_key).toBe('core_pulse_abc123');
    expect(cred.provider_row_id).toBe('core-row-1');
    expect(cred.status).toBe('active');

    // X-Operator header should include the super_admin's email for CORE's audit.
    const callArgs = fetchSpy.mock.calls[0];
    const headers = callArgs[1]?.headers as Headers;
    expect(headers.get('X-Provisioning-Secret')).toBe('test-provisioning-secret');
    expect(headers.get('X-Operator')).toBe('ops@inteliflowai.com');
  });

  it('records license + "not_provisioned" credential when CORE_PROVISIONING_SECRET is unset', async () => {
    delete process.env.CORE_PROVISIONING_SECRET;

    const fetchSpy = mockCoreFetch(async () => new Response('{}', { status: 200 }));

    const res = await provisionPOST(post('http://localhost/api/licenses', {
      tenant_id: 'tenant-A', product: 'core',
    }));
    expect(res.status).toBe(201);
    const body = await res.json();
    expect(body.license).toBeDefined();
    expect(body.credential?.status).toBe('not_provisioned');

    // We did NOT call CORE — no secret, no call.
    expect(fetchSpy).not.toHaveBeenCalled();

    const cred = mockSupabaseData.tenant_integration_credentials.find((c) => c.tenant_id === 'tenant-A');
    expect(cred).toBeDefined();
    expect(cred.status).toBe('not_provisioned');
    expect(cred.api_key).toBeNull();
    expect(cred.last_error).toMatch(/CORE_PROVISIONING_SECRET/);
  });

  it('records "not_provisioned" when CORE returns a non-409 error', async () => {
    mockCoreFetch(async () => new Response(JSON.stringify({ error: 'internal' }), { status: 500 }));

    const res = await provisionPOST(post('http://localhost/api/licenses', {
      tenant_id: 'tenant-A', product: 'core',
    }));
    expect(res.status).toBe(201);
    const body = await res.json();
    expect(body.credential?.status).toBe('not_provisioned');

    const cred = mockSupabaseData.tenant_integration_credentials.find((c) => c.tenant_id === 'tenant-A');
    expect(cred.last_error).toMatch(/500/);
  });

  it('does NOT touch credentials when product is not core (e.g. spark) — SPARK has no provisioning endpoint yet', async () => {
    const fetchSpy = mockCoreFetch(async () => new Response('{}', { status: 200 }));

    const res = await provisionPOST(post('http://localhost/api/licenses', {
      tenant_id: 'tenant-A', product: 'spark',
    }));
    expect(res.status).toBe(201);
    const body = await res.json();
    expect(body.credential).toBeNull();

    expect(fetchSpy).not.toHaveBeenCalled();
    expect(mockSupabaseData.tenant_integration_credentials).toHaveLength(0);
  });

  it('is idempotent: re-provisioning when an active credential exists does not churn the key', async () => {
    seedMockData({
      tenant_integration_credentials: [{
        id: 'cred-1',
        tenant_id: 'tenant-A',
        service: 'core',
        api_key: 'existing-key',
        provider_row_id: 'core-row-existing',
        status: 'active',
      } as any],
    });

    const fetchSpy = mockCoreFetch(async () => new Response('should not be called', { status: 500 }));

    const res = await provisionPOST(post('http://localhost/api/licenses', {
      tenant_id: 'tenant-A', product: 'core',
    }));
    expect(res.status).toBe(201);
    const body = await res.json();
    expect(body.credential?.status).toBe('active');

    // Shortcut taken — CORE was never called.
    expect(fetchSpy).not.toHaveBeenCalled();

    const cred = mockSupabaseData.tenant_integration_credentials.find((c) => c.tenant_id === 'tenant-A');
    expect(cred.api_key).toBe('existing-key');
  });
});

describe('DELETE /api/licenses/[id] — CORE credential revocation', () => {
  beforeEach(() => {
    seedMockData({
      users: [{ id: 'mock-user-id', role: 'super_admin', email: 'ops@inteliflowai.com' } as any],
      tenants: [fixtures.tenant({ id: 'tenant-A', name: 'Greenfield Academy' })],
      product_licenses: [{ id: 'lic-1', tenant_id: 'tenant-A', product: 'core', status: 'active' } as any],
      tenant_integration_credentials: [{
        id: 'cred-1',
        tenant_id: 'tenant-A',
        service: 'core',
        api_key: 'core_pulse_abc123',
        provider_row_id: 'core-row-1',
        status: 'active',
      } as any],
    });
    process.env.CORE_PROVISIONING_SECRET = 'test-provisioning-secret';
  });

  afterEach(() => vi.restoreAllMocks());

  it('calls CORE DELETE and marks the local credential revoked', async () => {
    const fetchSpy = mockCoreFetch(async (url, init) => {
      if (url.includes('/api/admin/platform-keys/core-row-1') && init?.method === 'DELETE') {
        return new Response(JSON.stringify({ ok: true, id: 'core-row-1' }), { status: 200 });
      }
      return new Response('unexpected', { status: 500 });
    });

    const res = await licenseDELETE(del('http://localhost/api/licenses/lic-1'), {
      params: Promise.resolve({ id: 'lic-1' }),
    });
    expect(res.status).toBe(200);

    expect(fetchSpy).toHaveBeenCalledTimes(1);
    const cred = mockSupabaseData.tenant_integration_credentials.find((c) => c.id === 'cred-1');
    expect(cred.status).toBe('revoked');
    expect(cred.revoked_at).toBeTruthy();
  });

  it('marks credential revoked locally even if CORE DELETE fails (CORE outage must not leave Pulse thinking the key is live)', async () => {
    mockCoreFetch(async () => new Response('{"error":"boom"}', { status: 503 }));

    const res = await licenseDELETE(del('http://localhost/api/licenses/lic-1'), {
      params: Promise.resolve({ id: 'lic-1' }),
    });
    expect(res.status).toBe(200);

    const cred = mockSupabaseData.tenant_integration_credentials.find((c) => c.id === 'cred-1');
    expect(cred.status).toBe('revoked');
    expect(cred.last_error).toMatch(/503/);
  });
});

describe('GET /api/nodes/[nodeId]/config — integration_credentials push', () => {
  beforeEach(() => {
    seedMockData({
      nodes: [fixtures.node({ id: 'node-A', tenant_id: 'tenant-A', site_id: 'site-A', status: 'active', registration_token: 'nt' })],
      tenant_integration_credentials: [
        { id: 'c1', tenant_id: 'tenant-A', service: 'core',  api_key: 'core-key',  api_url: null, status: 'active' } as any,
        { id: 'c2', tenant_id: 'tenant-A', service: 'spark', api_key: 'spark-key', api_url: null, status: 'revoked' } as any,
      ],
    });
  });

  it('returns only active credentials; revoked/not_provisioned are excluded', async () => {
    const res = await nodeConfigGET(
      get('http://localhost/api/nodes/node-A/config', { 'x-node-token': 'nt' }),
      { params: Promise.resolve({ nodeId: 'node-A' }) },
    );
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.integration_credentials?.core?.api_key).toBe('core-key');
    expect(body.integration_credentials?.spark).toBeUndefined();
  });
});
