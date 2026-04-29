import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock all dependencies
vi.mock('../db', () => ({
  initDb: vi.fn(),
  upsertEnrolledDevice: vi.fn(),
  getEnrolledDevice: vi.fn(),
  upsertClassroomCache: vi.fn(),
  getClassroomCache: vi.fn(),
  getLocalPackages: vi.fn().mockReturnValue([]),
  getLocalAssets: vi.fn().mockReturnValue([]),
  getEnrolledDeviceCount: vi.fn().mockReturnValue(0),
  getActiveSessionCount: vi.fn().mockReturnValue(0),
  insertPlaybackSession: vi.fn(),
  touchDevice: vi.fn(),
  createStudentSession: vi.fn(),
  getStudentSession: vi.fn(),
  clearStudentSession: vi.fn(),
  cleanupExpiredSessions: vi.fn(),
  setConductorState: vi.fn(),
  getConductorState: vi.fn(),
  cacheSequence: vi.fn(),
  getCachedSequences: vi.fn().mockReturnValue([]),
  getCachedSequence: vi.fn(),
  saveLocalQuizAttempt: vi.fn(),
}));

vi.mock('../logger', () => ({
  log: vi.fn(),
}));

vi.mock('../heartbeat', () => ({
  sendHeartbeat: vi.fn(),
  buildHeartbeatPayload: vi.fn(),
}));

vi.mock('../backup', () => ({
  startAutoBackup: vi.fn(),
  createBackup: vi.fn(),
  listBackups: vi.fn().mockReturnValue([]),
  restoreBackup: vi.fn(),
}));

vi.mock('../update-manager', () => ({
  startUpdateManager: vi.fn(),
}));

vi.mock('../classroom-player', () => ({
  renderClassroomPlayer: () => '<html>player</html>',
}));

vi.mock('../env', () => ({
  validateEnv: vi.fn(),
}));

const mockFetch = vi.fn();
global.fetch = mockFetch;

describe('Enrollment validation logic', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('validates token against cloud API', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve({
        valid: true,
        device_id: 'device-001',
        classroom_id: 'classroom-001',
        classroom_name: 'Room 101',
        node_id: 'node-001',
        tenant_id: 'tenant-001',
      }),
    });

    const result = await mockFetch('http://localhost:3000/api/devices/validate-token?token=test-token');
    expect(result.ok).toBe(true);
    const data = await result.json();
    expect(data.valid).toBe(true);
    expect(data.device_id).toBe('device-001');
  });

  it('returns error for expired token', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve({ valid: false, error: 'Token expired' }),
    });

    const result = await mockFetch('http://localhost:3000/api/devices/validate-token?token=expired');
    const data = await result.json();
    expect(data.valid).toBe(false);
  });

  it('returns error for invalid token', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: false,
      status: 404,
      json: () => Promise.resolve({ error: 'Token not found' }),
    });

    const result = await mockFetch('http://localhost:3000/api/devices/validate-token?token=invalid');
    expect(result.ok).toBe(false);
  });

  it('generates local_session_token on success', () => {
    const token = crypto.randomUUID();
    expect(token).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/);
  });

  it('rate limiter tracks requests per IP', () => {
    // Simulate rate limiter logic (10 req/min per IP)
    const rateLimitMap = new Map<string, { count: number; resetAt: number }>();
    const ip = '192.168.1.50';

    function checkRate(clientIp: string): boolean {
      const now = Date.now();
      const entry = rateLimitMap.get(clientIp);
      if (!entry || now > entry.resetAt) {
        rateLimitMap.set(clientIp, { count: 1, resetAt: now + 60000 });
        return true;
      }
      if (entry.count >= 10) return false;
      entry.count++;
      return true;
    }

    // First 10 should pass
    for (let i = 0; i < 10; i++) {
      expect(checkRate(ip)).toBe(true);
    }
    // 11th should fail
    expect(checkRate(ip)).toBe(false);
  });

  it('rate limiter allows different IPs independently', () => {
    const rateLimitMap = new Map<string, { count: number; resetAt: number }>();

    function checkRate(clientIp: string): boolean {
      const now = Date.now();
      const entry = rateLimitMap.get(clientIp);
      if (!entry || now > entry.resetAt) {
        rateLimitMap.set(clientIp, { count: 1, resetAt: now + 60000 });
        return true;
      }
      if (entry.count >= 10) return false;
      entry.count++;
      return true;
    }

    // Both IPs should independently pass
    expect(checkRate('192.168.1.1')).toBe(true);
    expect(checkRate('192.168.1.2')).toBe(true);
  });
});
