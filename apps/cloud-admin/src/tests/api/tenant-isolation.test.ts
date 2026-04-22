/**
 * Multi-tenant isolation regression tests.
 *
 * These tests exist because RLS alone is not verified by the rest of the
 * suite — CLAUDE.md and COVERAGE_GAPS.md flag this as a gap. We assert that
 * endpoints which accept a package_id (enqueue) or a node_id (node-jobs)
 * cannot be used to touch data belonging to another tenant.
 *
 * The mock Supabase layer models .eq() filtering but NOT RLS-by-session,
 * so these tests catch *application-level* tenant scoping — the belt that
 * should hold up even if the RLS suspenders ever break.
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { seedMockData, mockSupabaseData } from '../mocks/supabase';
import { fixtures } from '../fixtures';
import { POST as enqueuePOST } from '@/app/api/sync/enqueue/route';
import { GET as nodeJobsGET } from '@/app/api/sync/node-jobs/[nodeId]/route';
import { NextRequest } from 'next/server';

function postJson(url: string, body: any) {
  return new NextRequest(url, {
    method: 'POST',
    body: JSON.stringify(body),
    headers: { 'Content-Type': 'application/json' },
  });
}

function get(url: string, headers: Record<string, string> = {}) {
  return new NextRequest(url, { method: 'GET', headers });
}

describe('multi-tenant isolation', () => {
  beforeEach(() => {
    seedMockData({
      tenants: [
        fixtures.tenant({ id: 'tenant-A' }),
        fixtures.tenant({ id: 'tenant-B' }),
      ],
      sites: [
        fixtures.site({ id: 'site-A', tenant_id: 'tenant-A' }),
        fixtures.site({ id: 'site-B', tenant_id: 'tenant-B' }),
      ],
      nodes: [
        fixtures.node({ id: 'node-A', tenant_id: 'tenant-A', site_id: 'site-A', status: 'active', registration_token: 'token-A' }),
        fixtures.node({ id: 'node-B', tenant_id: 'tenant-B', site_id: 'site-B', status: 'active', registration_token: 'token-B' }),
      ],
      packages: [
        fixtures.package({ id: 'pkg-A', tenant_id: 'tenant-A', status: 'published', target_sites: ['site-A'] }),
        fixtures.package({ id: 'pkg-B', tenant_id: 'tenant-B', status: 'published', target_sites: ['site-B'] }),
      ],
      // Authenticated actor for the enqueue tests — content_manager in tenant-A.
      users: [{ id: 'mock-user-id', role: 'content_manager', tenant_id: 'tenant-A' } as any],
    });
  });

  it('enqueue for tenant A package does not touch tenant B nodes', async () => {
    const res = await enqueuePOST(postJson('http://localhost/api/sync/enqueue', { package_id: 'pkg-A' }));
    expect(res.status).toBe(200);
    const body = await res.json();

    expect(body.enqueued).toBe(1);
    const jobs = mockSupabaseData.sync_jobs;
    expect(jobs).toHaveLength(1);
    expect(jobs[0].node_id).toBe('node-A');
    expect(jobs.some((j) => j.node_id === 'node-B')).toBe(false);
  });

  it('node-jobs for node A only returns jobs belonging to node A', async () => {
    seedMockData({
      sync_jobs: [
        fixtures.syncJob({ id: 'job-A', tenant_id: 'tenant-A', package_id: 'pkg-A', node_id: 'node-A', status: 'pending' }),
        fixtures.syncJob({ id: 'job-B', tenant_id: 'tenant-B', package_id: 'pkg-B', node_id: 'node-B', status: 'pending' }),
      ],
    });

    const res = await nodeJobsGET(
      get('http://localhost/api/sync/node-jobs/node-A', { 'x-node-token': 'token-A' }),
      { params: Promise.resolve({ nodeId: 'node-A' }) },
    );
    const body = await res.json();

    expect(body.jobs).toHaveLength(1);
    expect(body.jobs[0].id).toBe('job-A');
    expect(body.jobs.some((j: any) => j.id === 'job-B')).toBe(false);
  });

  it('node-jobs rejects request without X-Node-Token', async () => {
    const res = await nodeJobsGET(get('http://localhost/api/sync/node-jobs/node-A'), {
      params: Promise.resolve({ nodeId: 'node-A' }),
    });
    expect(res.status).toBe(401);
  });

  it('node-jobs rejects node A URL with node B token (cross-node)', async () => {
    const res = await nodeJobsGET(
      get('http://localhost/api/sync/node-jobs/node-A', { 'x-node-token': 'token-B' }),
      { params: Promise.resolve({ nodeId: 'node-A' }) },
    );
    expect(res.status).toBe(401);
  });

  it('node-jobs rejects a valid token with the wrong nodeId in URL', async () => {
    // Attacker steals node-A's token but tries to fetch node-B's jobs.
    const res = await nodeJobsGET(
      get('http://localhost/api/sync/node-jobs/node-B', { 'x-node-token': 'token-A' }),
      { params: Promise.resolve({ nodeId: 'node-B' }) },
    );
    expect(res.status).toBe(401);
  });

  it('enqueue refuses to run on a package that has no active nodes in its own tenant', async () => {
    // Strip node-A (tenant A has no active node); tenant B's node-B is active but on site-B.
    seedMockData({
      nodes: [fixtures.node({ id: 'node-B', tenant_id: 'tenant-B', site_id: 'site-B', status: 'active' })],
    });

    const res = await enqueuePOST(postJson('http://localhost/api/sync/enqueue', { package_id: 'pkg-A' }));
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toMatch(/No active target nodes/i);
    expect(mockSupabaseData.sync_jobs).toHaveLength(0);
  });
});
