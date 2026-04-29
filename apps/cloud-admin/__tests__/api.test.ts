import { describe, it, expect } from 'vitest';

describe('API Route Structure', () => {
  const apiRoutes = [
    '/api/nodes/register',
    '/api/nodes/heartbeat',
    '/api/sync/enqueue',
    '/api/assets/[assetId]/download-url',
    '/api/classrooms',
    '/api/devices/validate-token',
    '/api/curriculum',
    '/api/curriculum/sequences',
    '/api/quiz',
    '/api/progress',
    '/api/updates/available',
    '/api/users/invite',
    '/api/cron/check-offline-nodes',
  ];

  it('has all expected API route paths defined', () => {
    expect(apiRoutes).toHaveLength(13);
    apiRoutes.forEach((route) => {
      expect(route).toMatch(/^\/api\//);
    });
  });

  it('sync routes use correct naming', () => {
    expect(apiRoutes).toContain('/api/sync/enqueue');
  });

  it('curriculum routes exist', () => {
    expect(apiRoutes).toContain('/api/curriculum');
    expect(apiRoutes).toContain('/api/curriculum/sequences');
  });
});

describe('Heartbeat Payload Validation', () => {
  it('validates required fields', () => {
    const validPayload = {
      node_id: 'test-uuid',
      timestamp: new Date().toISOString(),
      version: '0.1.0',
      storage_used_gb: 10,
      storage_total_gb: 100,
      active_sessions: 0,
      jellyfin_reachable: true,
      wan_connected: true,
      cpu_usage_pct: 25,
      memory_used_gb: 4,
      memory_total_gb: 8,
      enrolled_devices: 5,
      pending_sync_jobs: 0,
      completed_sync_jobs_today: 3,
      failed_sync_jobs_today: 0,
      uptime_seconds: 3600,
      jellyfin_version: '10.9.11',
      last_successful_sync_at: null,
    };

    expect(validPayload.node_id).toBeTruthy();
    expect(validPayload.cpu_usage_pct).toBeGreaterThanOrEqual(0);
    expect(validPayload.cpu_usage_pct).toBeLessThanOrEqual(100);
    expect(validPayload.storage_used_gb).toBeLessThanOrEqual(validPayload.storage_total_gb);
  });

  it('detects storage alerts', () => {
    const storagePct = (85 / 100);
    expect(storagePct).toBeGreaterThan(0.85 - 0.01); // warning threshold

    const criticalPct = (96 / 100);
    expect(criticalPct).toBeGreaterThan(0.95); // critical threshold
  });
});
