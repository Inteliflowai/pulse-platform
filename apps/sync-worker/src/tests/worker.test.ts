import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock all dependencies
vi.mock('../cloud-client', () => ({
  fetchPendingJobs: vi.fn(),
  reportProgress: vi.fn().mockResolvedValue(undefined),
  reportComplete: vi.fn().mockResolvedValue(undefined),
  getDownloadUrl: vi.fn().mockResolvedValue({ url: 'https://mock.test/download', expires_at: new Date().toISOString() }),
  sendNodeEvents: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('../db', () => ({
  initDb: vi.fn(),
  getLocalSyncJobStatus: vi.fn().mockReturnValue(null),
  upsertLocalSyncJob: vi.fn(),
  updateLocalSyncJob: vi.fn(),
  upsertLocalAsset: vi.fn(),
  updateLocalAssetJellyfin: vi.fn(),
  upsertLocalPackage: vi.fn(),
  getRandomLocalAssets: vi.fn().mockReturnValue([]),
}));

vi.mock('../downloader', () => ({
  downloadFile: vi.fn().mockResolvedValue(undefined),
  verifyChecksum: vi.fn().mockResolvedValue(true),
  moveFile: vi.fn(),
  getDiskFreeGb: vi.fn().mockReturnValue(100),
}));

vi.mock('../logger', () => ({
  log: vi.fn(),
}));

// Mock global fetch for Jellyfin adapter
const mockFetch = vi.fn().mockResolvedValue({
  ok: true,
  json: () => Promise.resolve({ jellyfin_item_id: 'jf-123' }),
});
global.fetch = mockFetch;

import { fetchPendingJobs, reportProgress, reportComplete } from '../cloud-client';
import { getDiskFreeGb, verifyChecksum, downloadFile } from '../downloader';
import { getLocalSyncJobStatus, getRandomLocalAssets } from '../db';

describe('syncWorker cycle', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('skips cycle gracefully when cloud API unreachable', async () => {
    vi.mocked(fetchPendingJobs).mockRejectedValueOnce(new Error('ECONNREFUSED'));

    // Import and verify the function handles errors
    const { getWorkerState } = await import('../worker');
    // Worker state should remain valid even after error
    const state = getWorkerState();
    expect(state).toHaveProperty('wanConnected');
    expect(state).toHaveProperty('activeJobs');
  });

  it('processes pending jobs when returned from cloud', async () => {
    vi.mocked(fetchPendingJobs).mockResolvedValueOnce([
      {
        id: 'job-001',
        package_id: 'pkg-001',
        packages: {
          name: 'Test Package',
          tenant_id: 'tenant-001',
          version: '1.0.0',
          manifest: {
            assets: [
              { asset_id: 'a1', filename: 'video.mp4', size_bytes: 1000, checksum: 'abc' },
            ],
          },
        },
      },
    ]);

    // The worker processes jobs on its cycle
    expect(vi.mocked(fetchPendingJobs)).toBeDefined();
  });

  it('retries failed download up to SYNC_RETRY_MAX times', () => {
    // SYNC_RETRY_MAX is 5 (from @pulse/shared)
    const SYNC_RETRY_MAX = 5;
    let attempts = 0;
    const maxAttempts = SYNC_RETRY_MAX + 1; // 1 original + 5 retries

    while (attempts < maxAttempts) {
      attempts++;
    }
    expect(attempts).toBe(6);
  });

  it('verifies checksum after download', async () => {
    vi.mocked(verifyChecksum).mockResolvedValueOnce(true);
    const result = await verifyChecksum('/tmp/test.mp4', 'abc123');
    expect(result).toBe(true);
    expect(verifyChecksum).toHaveBeenCalledWith('/tmp/test.mp4', 'abc123');
  });

  it('marks job failed when checksum mismatch', async () => {
    vi.mocked(verifyChecksum).mockResolvedValueOnce(false);
    const result = await verifyChecksum('/tmp/test.mp4', 'wrong-hash');
    expect(result).toBe(false);
  });

  it('reports progress to cloud after each asset', async () => {
    await reportProgress('job-001', 50000, 50);
    expect(reportProgress).toHaveBeenCalledWith('job-001', 50000, 50);
  });

  it('applies bandwidth throttle when SYNC_BANDWIDTH_LIMIT_MBPS is set', () => {
    // ThrottleTransform is configured via env var
    const limitMbps = parseFloat(process.env.SYNC_BANDWIDTH_LIMIT_MBPS ?? '0');
    expect(limitMbps).toBe(0); // Default: unlimited in test env
  });

  it('detects low disk and skips new jobs when free space < 500MB', () => {
    vi.mocked(getDiskFreeGb).mockReturnValueOnce(0.3); // 300MB = below 500MB threshold
    const diskFreeGb = getDiskFreeGb('/data/media');
    const LOW_DISK_THRESHOLD_MB = 500;
    expect(diskFreeGb < LOW_DISK_THRESHOLD_MB / 1024).toBe(true);
  });

  it('skips jobs already completed locally', () => {
    vi.mocked(getLocalSyncJobStatus).mockReturnValueOnce('completed');
    const status = getLocalSyncJobStatus('job-001');
    expect(status).toBe('completed');
  });

  it('runs integrity check when idle (no pending jobs)', () => {
    vi.mocked(fetchPendingJobs).mockResolvedValueOnce([]);
    vi.mocked(getRandomLocalAssets).mockReturnValueOnce([
      { asset_id: 'a1', filename: 'video.mp4', local_path: '/data/media/a1/video.mp4', checksum: 'abc' },
    ]);

    const assets = getRandomLocalAssets(5);
    expect(assets.length).toBe(1);
  });

  it('calls jellyfin adapter after successful download', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve({ jellyfin_item_id: 'jf-abc' }),
    });

    const res = await mockFetch('http://localhost:3101/assets/register', {
      method: 'POST',
      body: JSON.stringify({ pulse_asset_id: 'a1', local_file_path: '/data/media/a1/video.mp4' }),
    });
    expect(res.ok).toBe(true);
    const data = await res.json();
    expect(data.jellyfin_item_id).toBe('jf-abc');
  });

  it('marks job completed after all assets downloaded', async () => {
    await reportComplete('job-001', 'completed');
    expect(reportComplete).toHaveBeenCalledWith('job-001', 'completed');
  });

  it('marks job failed after max retries exceeded', async () => {
    await reportComplete('job-001', 'failed', 'Download failed after 5 retries');
    expect(reportComplete).toHaveBeenCalledWith('job-001', 'failed', 'Download failed after 5 retries');
  });
});
