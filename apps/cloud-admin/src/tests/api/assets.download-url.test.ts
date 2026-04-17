import { describe, it, expect, beforeEach } from 'vitest';
import { seedMockData, mockSupabaseData } from '../mocks/supabase';
import { fixtures } from '../fixtures';
import { GET } from '@/app/api/assets/[assetId]/download-url/route';
import { NextRequest } from 'next/server';

function makeRequest(assetId: string, headers: Record<string, string> = {}) {
  return new NextRequest(`http://localhost:3000/api/assets/${assetId}/download-url`, {
    method: 'GET',
    headers,
  });
}

const params = (assetId: string) => Promise.resolve({ assetId });

describe('GET /api/assets/[assetId]/download-url', () => {
  beforeEach(() => {
    seedMockData({
      nodes: [fixtures.node({ registration_token: 'node-token-abc', status: 'active' })],
      assets: [fixtures.asset({ id: 'asset-001', status: 'ready', storage_path: 'tenant-001/asset-001/video.mp4' })],
      sync_jobs: [fixtures.syncJob({ node_id: 'node-001', status: 'in_progress', package_id: 'package-001' })],
      package_assets: [{ id: 'pa-001', asset_id: 'asset-001', package_id: 'package-001' }],
    });
  });

  it('returns signed URL for valid asset with service secret', async () => {
    const res = await GET(
      makeRequest('asset-001', { 'x-node-secret': 'test-service-role-key' }),
      { params: params('asset-001') }
    );
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.url).toBeDefined();
    expect(body.url).toContain('mock-storage');
  });

  it('returns 404 for unknown asset_id', async () => {
    const res = await GET(
      makeRequest('nonexistent', { 'x-node-secret': 'test-service-role-key' }),
      { params: params('nonexistent') }
    );
    expect(res.status).toBe(404);
  });

  it('returns 401 when no auth header provided', async () => {
    const res = await GET(
      makeRequest('asset-001'),
      { params: params('asset-001') }
    );
    expect(res.status).toBe(401);
  });

  it('accepts X-Node-Token header for node authentication', async () => {
    const res = await GET(
      makeRequest('asset-001', { 'x-node-token': 'node-token-abc' }),
      { params: params('asset-001') }
    );
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.url).toBeDefined();
  });

  it('accepts x-node-secret header for service auth', async () => {
    const res = await GET(
      makeRequest('asset-001', { 'x-node-secret': 'test-service-role-key' }),
      { params: params('asset-001') }
    );
    expect(res.status).toBe(200);
  });

  it('returns expires_at in response', async () => {
    const res = await GET(
      makeRequest('asset-001', { 'x-node-secret': 'test-service-role-key' }),
      { params: params('asset-001') }
    );
    const body = await res.json();
    expect(body.expires_at).toBeDefined();
    // Should be roughly 3 hours from now
    const expires = new Date(body.expires_at).getTime();
    const threeHours = 3 * 60 * 60 * 1000;
    expect(expires - Date.now()).toBeLessThanOrEqual(threeHours + 5000);
    expect(expires - Date.now()).toBeGreaterThan(threeHours - 60000);
  });
});
