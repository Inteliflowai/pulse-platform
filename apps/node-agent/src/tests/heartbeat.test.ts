import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock external dependencies before importing
vi.mock('os', () => ({
  default: {
    cpus: () => [
      { times: { user: 100, nice: 0, sys: 50, idle: 800, irq: 0 } },
      { times: { user: 100, nice: 0, sys: 50, idle: 800, irq: 0 } },
    ],
    totalmem: () => 8 * 1024 * 1024 * 1024, // 8 GB
    freemem: () => 4 * 1024 * 1024 * 1024,  // 4 GB
  },
  cpus: () => [
    { times: { user: 100, nice: 0, sys: 50, idle: 800, irq: 0 } },
    { times: { user: 100, nice: 0, sys: 50, idle: 800, irq: 0 } },
  ],
  totalmem: () => 8 * 1024 * 1024 * 1024,
  freemem: () => 4 * 1024 * 1024 * 1024,
}));

vi.mock('child_process', () => ({
  execSync: () => 'Node,100000000,500000000000\n',
}));

vi.mock('../db', () => ({
  getEnrolledDeviceCount: () => 5,
  getActiveSessionCount: () => 2,
}));

vi.mock('../logger', () => ({
  log: vi.fn(),
}));

// Mock global fetch
const mockFetch = vi.fn();
global.fetch = mockFetch;

describe('buildHeartbeatPayload()', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Jellyfin reachable
    mockFetch.mockImplementation((url: string) => {
      if (typeof url === 'string' && url.includes('/health')) {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve({ jellyfin_reachable: true, jellyfin_version: '10.9.11' }),
        });
      }
      // WAN check (1.1.1.1)
      return Promise.resolve({ ok: true });
    });
  });

  it('includes node_id from env', async () => {
    const { buildHeartbeatPayload } = await import('../heartbeat');
    const payload = await buildHeartbeatPayload();
    expect(payload.node_id).toBe('test-node-001');
  });

  it('includes wan_connected boolean', async () => {
    const { buildHeartbeatPayload } = await import('../heartbeat');
    const payload = await buildHeartbeatPayload();
    expect(typeof payload.wan_connected).toBe('boolean');
  });

  it('includes jellyfin_reachable boolean', async () => {
    const { buildHeartbeatPayload } = await import('../heartbeat');
    const payload = await buildHeartbeatPayload();
    expect(typeof payload.jellyfin_reachable).toBe('boolean');
  });

  it('includes storage values', async () => {
    const { buildHeartbeatPayload } = await import('../heartbeat');
    const payload = await buildHeartbeatPayload();
    expect(typeof payload.storage_used_gb).toBe('number');
    expect(typeof payload.storage_total_gb).toBe('number');
  });

  it('includes active_sessions count from SQLite', async () => {
    const { buildHeartbeatPayload } = await import('../heartbeat');
    const payload = await buildHeartbeatPayload();
    expect(payload.active_sessions).toBe(2);
  });

  it('includes enrolled_devices count from SQLite', async () => {
    const { buildHeartbeatPayload } = await import('../heartbeat');
    const payload = await buildHeartbeatPayload();
    expect(payload.enrolled_devices).toBe(5);
  });

  it('returns valid HeartbeatPayload shape', async () => {
    const { buildHeartbeatPayload } = await import('../heartbeat');
    const payload = await buildHeartbeatPayload();

    expect(payload).toHaveProperty('node_id');
    expect(payload).toHaveProperty('timestamp');
    expect(payload).toHaveProperty('version');
    expect(payload).toHaveProperty('storage_used_gb');
    expect(payload).toHaveProperty('storage_total_gb');
    expect(payload).toHaveProperty('active_sessions');
    expect(payload).toHaveProperty('jellyfin_reachable');
    expect(payload).toHaveProperty('wan_connected');
    expect(payload).toHaveProperty('cpu_usage_pct');
    expect(payload).toHaveProperty('memory_used_gb');
    expect(payload).toHaveProperty('memory_total_gb');
    expect(payload).toHaveProperty('enrolled_devices');
    expect(payload).toHaveProperty('uptime_seconds');
  });
});
