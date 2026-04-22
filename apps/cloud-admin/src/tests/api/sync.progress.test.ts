import { describe, it, expect, beforeEach } from 'vitest';
import { seedMockData, mockSupabaseData } from '../mocks/supabase';
import { fixtures } from '../fixtures';
import { POST as progressPOST } from '@/app/api/sync/jobs/[jobId]/progress/route';
import { POST as completePOST } from '@/app/api/sync/jobs/[jobId]/complete/route';
import { NextRequest } from 'next/server';

const NODE_TOKEN = 'test-node-token';
const AUTH_HEADERS = { 'Content-Type': 'application/json', 'x-node-token': NODE_TOKEN };

function makeProgressRequest(jobId: string, body: Record<string, any>) {
  return new NextRequest(`http://localhost:3000/api/sync/jobs/${jobId}/progress`, {
    method: 'POST',
    body: JSON.stringify(body),
    headers: AUTH_HEADERS,
  });
}

function makeCompleteRequest(jobId: string, body: Record<string, any>) {
  return new NextRequest(`http://localhost:3000/api/sync/jobs/${jobId}/complete`, {
    method: 'POST',
    body: JSON.stringify(body),
    headers: AUTH_HEADERS,
  });
}

const params = (jobId: string) => Promise.resolve({ jobId });

describe('POST /api/sync/jobs/[jobId]/progress', () => {
  beforeEach(() => {
    seedMockData({
      nodes: [fixtures.node({ id: 'node-001', status: 'active', registration_token: NODE_TOKEN })],
      sync_jobs: [fixtures.syncJob({ id: 'job-001', node_id: 'node-001', status: 'in_progress' })],
    });
  });

  it('updates bytes_transferred and progress_pct', async () => {
    const res = await progressPOST(
      makeProgressRequest('job-001', { bytes_transferred: 50000000, progress_pct: 48 }),
      { params: params('job-001') }
    );
    expect(res.status).toBe(200);
    const job = mockSupabaseData.sync_jobs[0];
    expect(job.bytes_transferred).toBe(50000000);
    expect(job.progress_pct).toBe(48);
  });

  it('updates status when provided', async () => {
    await progressPOST(
      makeProgressRequest('job-001', { status: 'in_progress', bytes_transferred: 0, progress_pct: 0 }),
      { params: params('job-001') }
    );
    const job = mockSupabaseData.sync_jobs[0];
    expect(job.status).toBe('in_progress');
  });

  it('returns ok: true on success', async () => {
    const res = await progressPOST(
      makeProgressRequest('job-001', { bytes_transferred: 1000 }),
      { params: params('job-001') }
    );
    const body = await res.json();
    expect(body.ok).toBe(true);
  });
});

describe('POST /api/sync/jobs/[jobId]/complete', () => {
  beforeEach(() => {
    seedMockData({
      nodes: [fixtures.node({ id: 'node-001', status: 'active', registration_token: NODE_TOKEN })],
      sync_jobs: [
        {
          ...fixtures.syncJob({ id: 'job-001', node_id: 'node-001', status: 'in_progress' }),
          package_id: 'package-001',
          packages: { name: 'Week 1', tenant_id: 'tenant-001' },
        },
      ],
    });
  });

  it('sets status to completed and sets completed_at', async () => {
    const res = await completePOST(
      makeCompleteRequest('job-001', { status: 'completed' }),
      { params: params('job-001') }
    );
    expect(res.status).toBe(200);
    const job = mockSupabaseData.sync_jobs[0];
    expect(job.status).toBe('completed');
    expect(job.completed_at).toBeDefined();
  });

  it('sets status to failed with error_message', async () => {
    await completePOST(
      makeCompleteRequest('job-001', { status: 'failed', error_message: 'Checksum mismatch' }),
      { params: params('job-001') }
    );
    const job = mockSupabaseData.sync_jobs[0];
    expect(job.status).toBe('failed');
    expect(job.error_message).toBe('Checksum mismatch');
  });

  it('writes audit_log on completion', async () => {
    await completePOST(
      makeCompleteRequest('job-001', { status: 'completed' }),
      { params: params('job-001') }
    );
    const logs = mockSupabaseData.audit_logs;
    expect(logs.length).toBeGreaterThanOrEqual(1);
    const syncLog = logs.find((l) => l.event_type === 'sync_completed');
    expect(syncLog).toBeDefined();
  });

  it('returns 404 for unknown job_id', async () => {
    const res = await completePOST(
      makeCompleteRequest('nonexistent', { status: 'completed' }),
      { params: params('nonexistent') }
    );
    expect(res.status).toBe(404);
  });
});
