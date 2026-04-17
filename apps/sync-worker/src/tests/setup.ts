import { beforeEach, vi } from 'vitest';

process.env.NODE_ID = 'test-node-001';
process.env.CLOUD_API_URL = 'http://localhost:3000';
process.env.NODE_REGISTRATION_TOKEN = 'test-reg-token';
process.env.JELLYFIN_ADAPTER_URL = 'http://localhost:3101';
process.env.MEDIA_DIR = '/tmp/test-media';
process.env.SYNC_DATA_DIR = '/tmp/test-sync';
process.env.HEALTH_PORT = '3200';
process.env.SYNC_BANDWIDTH_LIMIT_MBPS = '0';
process.env.NODE_ENV = 'test';

beforeEach(() => {
  vi.clearAllMocks();
  vi.restoreAllMocks();
});
