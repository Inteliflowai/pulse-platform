import { beforeEach, vi } from 'vitest';

process.env.NODE_ID = 'test-node-001';
process.env.CLOUD_API_URL = 'http://localhost:3000';
process.env.NODE_REGISTRATION_TOKEN = 'test-reg-token';
process.env.JELLYFIN_ADAPTER_URL = 'http://localhost:3101';
process.env.PORT = '3100';
process.env.DATA_DIR = '/tmp/test-data';
process.env.NODE_ENV = 'test';

beforeEach(() => {
  vi.clearAllMocks();
  vi.restoreAllMocks();
});
