import { describe, it, expect, beforeEach } from 'vitest';
import { seedMockData, mockSupabaseData } from '../mocks/supabase';
import { fixtures } from '../fixtures';
import { POST } from '@/app/api/sync/enqueue/route';
import { NextRequest } from 'next/server';

function makeRequest(body: Record<string, any>) {
  return new NextRequest('http://localhost:3000/api/sync/enqueue', {
    method: 'POST',
    body: JSON.stringify(body),
    headers: { 'Content-Type': 'application/json' },
  });
}

describe('POST /api/sync/enqueue', () => {
  beforeEach(() => {
    seedMockData({
      packages: [fixtures.package({ status: 'published', target_sites: ['site-001'] })],
      nodes: [fixtures.node({ status: 'active', site_id: 'site-001' })],
    });
  });

  it('creates sync_job for each target node when package is published', async () => {
    const res = await POST(makeRequest({ package_id: 'package-001' }));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.enqueued).toBe(1);
    expect(body.jobs).toHaveLength(1);
  });

  it('returns enqueued count and job list', async () => {
    const res = await POST(makeRequest({ package_id: 'package-001' }));
    const body = await res.json();
    expect(typeof body.enqueued).toBe('number');
    expect(Array.isArray(body.jobs)).toBe(true);
  });

  it('does not create duplicate job when pending job already exists', async () => {
    seedMockData({
      packages: [fixtures.package({ status: 'published' })],
      nodes: [fixtures.node({ status: 'active' })],
      sync_jobs: [fixtures.syncJob({ package_id: 'package-001', node_id: 'node-001', status: 'pending' })],
    });

    const res = await POST(makeRequest({ package_id: 'package-001' }));
    const body = await res.json();
    expect(body.enqueued).toBe(0);
  });

  it('does not create duplicate job when in_progress job exists', async () => {
    seedMockData({
      packages: [fixtures.package({ status: 'published' })],
      nodes: [fixtures.node({ status: 'active' })],
      sync_jobs: [fixtures.syncJob({ package_id: 'package-001', node_id: 'node-001', status: 'in_progress' })],
    });

    const res = await POST(makeRequest({ package_id: 'package-001' }));
    const body = await res.json();
    expect(body.enqueued).toBe(0);
  });

  it('returns 400 when package_id is missing', async () => {
    const res = await POST(makeRequest({}));
    expect(res.status).toBe(400);
  });

  it('returns 400 when package status is not published', async () => {
    seedMockData({
      packages: [fixtures.package({ status: 'draft' })],
    });

    const res = await POST(makeRequest({ package_id: 'package-001' }));
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toContain('published');
  });

  it('returns 404 when package not found', async () => {
    const res = await POST(makeRequest({ package_id: 'nonexistent' }));
    expect(res.status).toBe(404);
  });

  it('respects node_ids filter when provided', async () => {
    seedMockData({
      packages: [fixtures.package({ status: 'published' })],
      nodes: [
        fixtures.node({ id: 'node-001', status: 'active' }),
        fixtures.node({ id: 'node-002', status: 'active' }),
      ],
    });

    const res = await POST(makeRequest({ package_id: 'package-001', node_ids: ['node-002'] }));
    const body = await res.json();
    expect(body.enqueued).toBe(1);
    expect(body.jobs[0].node_id).toBe('node-002');
  });

  it('targets all site nodes when node_ids omitted', async () => {
    seedMockData({
      packages: [fixtures.package({ status: 'published', target_sites: ['site-001'] })],
      nodes: [
        fixtures.node({ id: 'node-001', status: 'active', site_id: 'site-001' }),
        fixtures.node({ id: 'node-002', status: 'active', site_id: 'site-001' }),
      ],
    });

    const res = await POST(makeRequest({ package_id: 'package-001' }));
    const body = await res.json();
    expect(body.enqueued).toBe(2);
  });
});
