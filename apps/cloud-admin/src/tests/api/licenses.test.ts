import { describe, it, expect, beforeEach } from 'vitest';
import { seedMockData, mockSupabaseData } from '../mocks/supabase';
import { fixtures } from '../fixtures';
import { GET as listGET, POST as listPOST } from '@/app/api/licenses/route';
import { DELETE as licenseDELETE } from '@/app/api/licenses/[id]/route';
import { GET as customersGET, POST as customersPOST } from '@/app/api/global/customers/route';
import { NextRequest } from 'next/server';

function get(url: string) {
  return new NextRequest(url, { method: 'GET' });
}

function post(url: string, body: any) {
  return new NextRequest(url, {
    method: 'POST',
    body: JSON.stringify(body),
    headers: { 'Content-Type': 'application/json' },
  });
}

describe('POST /api/licenses (provision)', () => {
  beforeEach(() => {
    seedMockData({
      users: [{ id: 'mock-user-id', role: 'super_admin', tenant_id: 'tenant-A' } as any],
      tenants: [fixtures.tenant({ id: 'tenant-A', name: 'Greenfield Academy' })],
    });
  });

  it('creates a license for a valid tenant + product', async () => {
    const res = await listPOST(post('http://localhost/api/licenses', {
      tenant_id: 'tenant-A', product: 'spark', plan: 'professional', seats: 50,
    }));
    expect(res.status).toBe(201);
    const body = await res.json();
    expect(body.license.product).toBe('spark');
    expect(body.license.plan).toBe('professional');
    expect(mockSupabaseData.product_licenses).toHaveLength(1);
  });

  it('rejects invalid product', async () => {
    const res = await listPOST(post('http://localhost/api/licenses', {
      tenant_id: 'tenant-A', product: 'bogus',
    }));
    expect(res.status).toBe(400);
  });

  it('rejects missing tenant_id', async () => {
    const res = await listPOST(post('http://localhost/api/licenses', { product: 'spark' }));
    expect(res.status).toBe(400);
  });

  it('404s when tenant does not exist', async () => {
    const res = await listPOST(post('http://localhost/api/licenses', {
      tenant_id: 'no-such-tenant', product: 'spark',
    }));
    expect(res.status).toBe(404);
  });

  it('writes an audit log entry on successful provision', async () => {
    await listPOST(post('http://localhost/api/licenses', {
      tenant_id: 'tenant-A', product: 'core',
    }));
    const logs = mockSupabaseData.audit_logs;
    expect(logs.some((l) => l.event_type === 'license_provisioned')).toBe(true);
  });
});

describe('license super_admin enforcement', () => {
  it('GET /api/licenses rejects non-super_admin', async () => {
    seedMockData({
      users: [{ id: 'mock-user-id', role: 'tenant_admin', tenant_id: 'tenant-A' } as any],
    });
    const res = await listGET(get('http://localhost/api/licenses'));
    expect(res.status).toBe(403);
  });

  it('POST /api/licenses rejects non-super_admin', async () => {
    seedMockData({
      users: [{ id: 'mock-user-id', role: 'site_admin', tenant_id: 'tenant-A' } as any],
    });
    const res = await listPOST(post('http://localhost/api/licenses', { tenant_id: 'tenant-A', product: 'spark' }));
    expect(res.status).toBe(403);
  });

  it('DELETE /api/licenses/[id] rejects non-super_admin', async () => {
    seedMockData({
      users: [{ id: 'mock-user-id', role: 'teacher', tenant_id: 'tenant-A' } as any],
      product_licenses: [{ id: 'lic-1', tenant_id: 'tenant-A', product: 'spark', status: 'active' } as any],
    });
    const res = await licenseDELETE(
      new NextRequest('http://localhost/api/licenses/lic-1', { method: 'DELETE' }),
      { params: Promise.resolve({ id: 'lic-1' }) },
    );
    expect(res.status).toBe(403);
  });
});

describe('DELETE /api/licenses/[id] (suspend)', () => {
  beforeEach(() => {
    seedMockData({
      users: [{ id: 'mock-user-id', role: 'super_admin', tenant_id: 'tenant-A' } as any],
      tenants: [fixtures.tenant({ id: 'tenant-A' })],
      product_licenses: [
        { id: 'lic-1', tenant_id: 'tenant-A', product: 'spark', status: 'active' } as any,
      ],
    });
  });

  it('soft-revokes by setting status=suspended rather than deleting', async () => {
    const res = await licenseDELETE(
      new NextRequest('http://localhost/api/licenses/lic-1', { method: 'DELETE' }),
      { params: Promise.resolve({ id: 'lic-1' }) },
    );
    expect(res.status).toBe(200);

    const row = mockSupabaseData.product_licenses.find((l) => l.id === 'lic-1');
    expect(row).toBeDefined();
    expect(row.status).toBe('suspended');
  });

  it('returns 404 for unknown license id', async () => {
    const res = await licenseDELETE(
      new NextRequest('http://localhost/api/licenses/does-not-exist', { method: 'DELETE' }),
      { params: Promise.resolve({ id: 'does-not-exist' }) },
    );
    expect(res.status).toBe(404);
  });
});

describe('GET /api/global/customers', () => {
  it('rejects non-super_admin', async () => {
    seedMockData({
      users: [{ id: 'mock-user-id', role: 'tenant_admin', tenant_id: 'tenant-A' } as any],
    });
    const res = await customersGET();
    expect(res.status).toBe(403);
  });

  it('returns tenants with tallies when super_admin', async () => {
    seedMockData({
      users: [{ id: 'mock-user-id', role: 'super_admin', tenant_id: 'tenant-A' } as any],
      tenants: [fixtures.tenant({ id: 'tenant-A', name: 'Greenfield' })],
      sites: [fixtures.site({ id: 'site-1', tenant_id: 'tenant-A' })],
      nodes: [
        fixtures.node({ id: 'n-1', tenant_id: 'tenant-A', status: 'active' }),
        fixtures.node({ id: 'n-2', tenant_id: 'tenant-A', status: 'offline' }),
      ],
      product_licenses: [
        { id: 'lic-1', tenant_id: 'tenant-A', product: 'spark', status: 'active', expires_at: null } as any,
      ],
    });
    const res = await customersGET();
    expect(res.status).toBe(200);
    const body = await res.json();
    const greenfield = body.customers.find((c: any) => c.id === 'tenant-A');
    expect(greenfield).toBeDefined();
    expect(greenfield.sites).toBe(1);
    expect(greenfield.nodes).toBe(2);
    expect(greenfield.nodes_online).toBe(1);
    expect(greenfield.licenses).toContain('spark');
  });
});

describe('POST /api/global/customers (create tenant)', () => {
  beforeEach(() => {
    seedMockData({
      users: [{ id: 'mock-user-id', role: 'super_admin', tenant_id: 'tenant-A' } as any],
    });
  });

  it('creates a tenant with auto-slug from name', async () => {
    const res = await customersPOST(post('http://localhost/api/global/customers', { name: 'Bright Academy' }));
    expect(res.status).toBe(201);
    const body = await res.json();
    expect(body.tenant.slug).toBe('bright-academy');
  });

  it('rejects missing name', async () => {
    const res = await customersPOST(post('http://localhost/api/global/customers', {}));
    expect(res.status).toBe(400);
  });
});
