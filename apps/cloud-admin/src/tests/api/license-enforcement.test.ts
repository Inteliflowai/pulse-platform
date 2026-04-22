/**
 * Enforcement tests for license gates + auto-expiry cron + /api/licenses/mine.
 *
 * Pins the contract: (1) CORE import requires an active/trial CORE license,
 * returns 402 otherwise, (2) the cron flips expired rows idempotently,
 * (3) /mine only ever returns the caller's own tenant's licenses.
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { seedMockData, mockSupabaseData } from '../mocks/supabase';
import { fixtures } from '../fixtures';
import { POST as importPOST } from '@/app/api/class-groups/import-from-core/route';
import { GET as expireGET } from '@/app/api/cron/expire-licenses/route';
import { GET as mineGET } from '@/app/api/licenses/mine/route';
import { NextRequest } from 'next/server';

function post(url: string, body: any) {
  return new NextRequest(url, {
    method: 'POST',
    body: JSON.stringify(body),
    headers: { 'Content-Type': 'application/json' },
  });
}

function get(url: string, headers: Record<string, string> = {}) {
  return new NextRequest(url, { method: 'GET', headers });
}

describe('CORE import license gate', () => {
  beforeEach(() => {
    seedMockData({
      users: [{ id: 'mock-user-id', role: 'tenant_admin', tenant_id: 'tenant-A', site_id: 'site-A' } as any],
      tenants: [fixtures.tenant({ id: 'tenant-A' })],
    });
  });

  it('rejects with 402 when CORE is not licensed', async () => {
    const res = await importPOST(post('http://localhost/api/class-groups/import-from-core', {
      core_api_url: 'http://core.test',
      core_session_token: 'tok',
    }));
    expect(res.status).toBe(402);
    const body = await res.json();
    expect(body.license_state).toBe('missing');
  });

  it('rejects with 402 when CORE license is suspended', async () => {
    seedMockData({
      product_licenses: [{ id: 'lic', tenant_id: 'tenant-A', product: 'core', status: 'suspended', expires_at: null } as any],
    });
    const res = await importPOST(post('http://localhost/api/class-groups/import-from-core', {
      core_api_url: 'http://core.test',
      core_session_token: 'tok',
    }));
    expect(res.status).toBe(402);
  });

  it('rejects with 402 when CORE license expired', async () => {
    const past = new Date(Date.now() - 86_400_000).toISOString();
    seedMockData({
      product_licenses: [{ id: 'lic', tenant_id: 'tenant-A', product: 'core', status: 'active', expires_at: past } as any],
    });
    const res = await importPOST(post('http://localhost/api/class-groups/import-from-core', {
      core_api_url: 'http://core.test',
      core_session_token: 'tok',
    }));
    expect(res.status).toBe(402);
  });

  it('passes the gate when CORE is actively licensed (trial counts)', async () => {
    seedMockData({
      product_licenses: [{ id: 'lic', tenant_id: 'tenant-A', product: 'core', status: 'trial', expires_at: null } as any],
    });
    // Stub the CORE fetch so we don't actually hit the network.
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(JSON.stringify({ classes: [] }), { status: 200 }) as any,
    );
    const res = await importPOST(post('http://localhost/api/class-groups/import-from-core', {
      core_api_url: 'http://core.test',
      core_session_token: 'tok',
    }));
    expect(res.status).toBe(200);
    fetchSpy.mockRestore();
  });
});

describe('GET /api/cron/expire-licenses', () => {
  beforeEach(() => {
    process.env.CRON_SECRET = 'test-cron-secret';
    seedMockData({
      tenants: [fixtures.tenant({ id: 'tenant-A' })],
      product_licenses: [
        { id: 'past-active',  tenant_id: 'tenant-A', product: 'spark', status: 'active', expires_at: new Date(Date.now() - 86_400_000).toISOString() } as any,
        { id: 'past-trial',   tenant_id: 'tenant-A', product: 'core',  status: 'trial',  expires_at: new Date(Date.now() - 2 * 86_400_000).toISOString() } as any,
        { id: 'future',       tenant_id: 'tenant-A', product: 'pulse', status: 'active', expires_at: new Date(Date.now() + 30 * 86_400_000).toISOString() } as any,
        { id: 'perpetual',    tenant_id: 'tenant-A', product: 'lift',  status: 'active', expires_at: null } as any,
        { id: 'past-suspend', tenant_id: 'tenant-A', product: 'core',  status: 'suspended', expires_at: new Date(Date.now() - 86_400_000).toISOString() } as any,
      ],
    });
  });

  it('requires CRON_SECRET', async () => {
    const res = await expireGET(get('http://localhost/api/cron/expire-licenses'));
    expect(res.status).toBe(401);
  });

  it('flips expired active/trial licenses to status=expired', async () => {
    const res = await expireGET(get('http://localhost/api/cron/expire-licenses', { 'x-cron-secret': 'test-cron-secret' }));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.expired).toBe(2);

    const rows = mockSupabaseData.product_licenses;
    expect(rows.find((r) => r.id === 'past-active').status).toBe('expired');
    expect(rows.find((r) => r.id === 'past-trial').status).toBe('expired');
    // Untouched:
    expect(rows.find((r) => r.id === 'future').status).toBe('active');
    expect(rows.find((r) => r.id === 'perpetual').status).toBe('active');
    expect(rows.find((r) => r.id === 'past-suspend').status).toBe('suspended');
  });

  it('writes audit_log entries for each expired license', async () => {
    await expireGET(get('http://localhost/api/cron/expire-licenses', { 'x-cron-secret': 'test-cron-secret' }));
    const expiredEvents = mockSupabaseData.audit_logs.filter((l) => l.event_type === 'license_expired');
    expect(expiredEvents.length).toBe(2);
  });

  it('is idempotent — a second run expires nothing', async () => {
    await expireGET(get('http://localhost/api/cron/expire-licenses', { 'x-cron-secret': 'test-cron-secret' }));
    const res2 = await expireGET(get('http://localhost/api/cron/expire-licenses', { 'x-cron-secret': 'test-cron-secret' }));
    const body2 = await res2.json();
    expect(body2.expired).toBe(0);
  });
});

describe('GET /api/licenses/mine', () => {
  beforeEach(() => {
    seedMockData({
      users: [
        { id: 'mock-user-id', role: 'teacher', tenant_id: 'tenant-A' } as any,
      ],
      product_licenses: [
        { id: 'a-spark', tenant_id: 'tenant-A', product: 'spark', plan: 'professional', seats: 100, starts_at: new Date().toISOString(), expires_at: null, status: 'active' } as any,
        { id: 'b-spark', tenant_id: 'tenant-B', product: 'spark', plan: 'starter',      seats: 0,   starts_at: new Date().toISOString(), expires_at: null, status: 'active' } as any,
      ],
    });
  });

  it('returns the caller tenant licenses with resolved state', async () => {
    const res = await mineGET(get('http://localhost/api/licenses/mine'));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.tenant_id).toBe('tenant-A');
    expect(body.licenses).toHaveLength(1);
    expect(body.licenses[0].product).toBe('spark');
    expect(body.licenses[0].state).toBe('active');
  });

  it('does not leak other tenants licenses', async () => {
    const res = await mineGET(get('http://localhost/api/licenses/mine'));
    const body = await res.json();
    expect(body.licenses.some((l: any) => l.product === 'spark' && l.plan === 'starter')).toBe(false);
  });
});
