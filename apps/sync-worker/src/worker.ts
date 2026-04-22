import { SYNC_RETRY_MAX } from '@pulse/shared';
import { log } from './logger';
import {
  fetchPendingJobs,
  reportProgress,
  reportComplete,
  getDownloadUrl,
  sendNodeEvents,
} from './cloud-client';
import {
  upsertLocalSyncJob,
  updateLocalSyncJob,
  upsertLocalAsset,
  updateLocalAssetJellyfin,
  upsertLocalPackage,
  getRandomLocalAssets,
  getLocalSyncJobStatus,
} from './db';
import { downloadFile, verifyChecksum, moveFile, getDiskFreeGb } from './downloader';
import { createReadStream } from 'fs';
import { createHash } from 'crypto';

const SYNC_DATA_DIR = process.env.SYNC_DATA_DIR ?? '/data/sync';
const MEDIA_DIR = process.env.MEDIA_DIR ?? '/data/media';
const JELLYFIN_ADAPTER_URL = process.env.JELLYFIN_ADAPTER_URL ?? 'http://jellyfin-adapter:3101';
const SYNC_POLL_INTERVAL_MS = parseInt(process.env.SYNC_POLL_INTERVAL_MS ?? '30000', 10);
const LOW_DISK_THRESHOLD_MB = 500;

let wanConnected = true;
let lastSyncAt: string | null = null;
let activeJobs = 0;
let queuedEvents: any[] = [];
let cycleInterval: NodeJS.Timeout | null = null;
let shuttingDown = false;

export function getWorkerState() {
  return { wanConnected, lastSyncAt, activeJobs };
}

export function startWorker() {
  log('info', 'Sync worker started', { pollInterval: SYNC_POLL_INTERVAL_MS });
  syncCycle(); // Run immediately
  cycleInterval = setInterval(syncCycle, SYNC_POLL_INTERVAL_MS);
}

export async function stopWorker(): Promise<void> {
  shuttingDown = true;
  if (cycleInterval) { clearInterval(cycleInterval); cycleInterval = null; }
  // Wait for in-flight job to finish (max 10s).
  const deadline = Date.now() + 10_000;
  while (activeJobs > 0 && Date.now() < deadline) {
    await new Promise((r) => setTimeout(r, 250));
  }
  if (activeJobs > 0) {
    log('warning', 'Shutdown timeout with active jobs still running', { activeJobs });
  }
}

export function isShuttingDown() { return shuttingDown; }

async function syncCycle() {
  try {
    // Check WAN by attempting to reach cloud
    let jobs: any[];
    try {
      jobs = await fetchPendingJobs();
      if (!wanConnected) {
        wanConnected = true;
        log('info', 'WAN connectivity restored');
        // Flush queued events
        if (queuedEvents.length > 0) {
          try {
            await sendNodeEvents(queuedEvents);
            queuedEvents = [];
          } catch { /* will retry next cycle */ }
        }
      }
    } catch (err: any) {
      if (wanConnected) {
        wanConnected = false;
        log('warning', 'WAN connectivity lost, will retry next cycle', { error: err.message });
      }
      return; // Skip cycle
    }

    if (jobs.length === 0) {
      // Integrity check on random 5% of local assets
      await integrityCheck();
      return;
    }

    // Check disk space
    const diskFreeGb = getDiskFreeGb(MEDIA_DIR);
    if (diskFreeGb < LOW_DISK_THRESHOLD_MB / 1024) {
      log('warning', 'Low disk space, skipping new jobs', { disk_free_gb: diskFreeGb });
      queuedEvents.push({
        event_type: 'low_disk',
        severity: 'warning',
        message: `Disk free: ${diskFreeGb.toFixed(2)} GB (below ${LOW_DISK_THRESHOLD_MB}MB threshold)`,
        metadata: { disk_free_gb: diskFreeGb },
      });
      return;
    }

    for (const job of jobs) {
      // Skip jobs already completed locally
      const localStatus = getLocalSyncJobStatus(job.id);
      if (localStatus === 'completed') {
        // Tell the cloud it's done (in case it missed the previous report)
        try { await reportComplete(job.id, 'completed'); } catch {}
        continue;
      }
      await processJob(job);
    }

    lastSyncAt = new Date().toISOString();
  } catch (err: any) {
    log('error', 'Sync cycle error', { error: err.message });
  }
}

async function processJob(job: any) {
  const jobId = job.id;
  const pkg = job.packages;
  const manifest = pkg?.manifest;

  if (!manifest || !manifest.assets) {
    log('error', 'Job has no manifest', { jobId });
    await reportComplete(jobId, 'failed', 'Missing package manifest');
    return;
  }

  log('info', 'Processing sync job', { jobId, packageName: pkg.name, assetCount: manifest.assets.length });
  activeJobs++;

  let retries = job.retries ?? 0;

  try {
    // Mark in_progress
    await reportProgress(jobId, 0, 0, 'in_progress');
    await upsertLocalSyncJob(jobId, job.package_id, 'in_progress', manifest);

    const totalBytes = manifest.assets.reduce((sum: number, a: any) => sum + (a.size_bytes ?? 0), 0);
    let downloadedBytes = 0;

    for (let i = 0; i < manifest.assets.length; i++) {
      const asset = manifest.assets[i];
      let success = false;

      for (let attempt = 0; attempt <= SYNC_RETRY_MAX && !success; attempt++) {
        try {
          await downloadAsset(asset, pkg.tenant_id);
          downloadedBytes += asset.size_bytes ?? 0;
          success = true;
        } catch (err: any) {
          log('warning', `Asset download failed (attempt ${attempt + 1})`, {
            assetId: asset.asset_id,
            error: err.message,
          });
          if (attempt === SYNC_RETRY_MAX) throw err;
          await new Promise((r) => setTimeout(r, 2000 * (attempt + 1)));
        }
      }

      // Report progress
      const pct = Math.round(((i + 1) / manifest.assets.length) * 100);
      try {
        await reportProgress(jobId, downloadedBytes, pct);
      } catch {
        // WAN may have dropped mid-sync, continue downloading
      }
    }

    // All assets downloaded — update local package record
    await upsertLocalPackage(job.package_id, pkg.name, pkg.version, manifest);
    await updateLocalSyncJob(jobId, 'completed');
    await reportComplete(jobId, 'completed');
    log('info', 'Sync job completed', { jobId, packageName: pkg.name });

  } catch (err: any) {
    retries++;
    log('error', 'Sync job failed', { jobId, error: err.message, retries });
    await updateLocalSyncJob(jobId, 'failed', err.message);

    if (retries > SYNC_RETRY_MAX) {
      try { await reportComplete(jobId, 'failed', err.message); } catch { /* WAN may be down */ }
    }
  } finally {
    activeJobs--;
  }
}

async function downloadAsset(asset: any, tenantId: string) {
  const { asset_id, filename, checksum, size_bytes } = asset;
  const tmpPath = `${SYNC_DATA_DIR}/tmp/${asset_id}_${filename}`;
  const finalPath = `${MEDIA_DIR}/${tenantId}/${asset_id}/${filename}`;

  log('info', 'Downloading asset', { asset_id, filename });

  // Get signed download URL
  const { url } = await getDownloadUrl(asset_id);

  // Stream download
  await downloadFile(url, tmpPath, size_bytes);

  // Verify checksum
  if (checksum) {
    const valid = await verifyChecksum(tmpPath, checksum);
    if (!valid) {
      throw new Error(`Checksum mismatch for asset ${asset_id}`);
    }
  }

  // Move to final location
  moveFile(tmpPath, finalPath);

  // Update local DB
  await upsertLocalAsset(asset_id, filename, finalPath, checksum ?? '', size_bytes ?? 0);

  // Register with Jellyfin adapter
  try {
    const res = await fetch(`${JELLYFIN_ADAPTER_URL}/assets/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ pulse_asset_id: asset_id, local_file_path: finalPath }),
    });

    if (res.ok) {
      const data: any = await res.json();
      if (data.jellyfin_item_id) {
        await updateLocalAssetJellyfin(asset_id, data.jellyfin_item_id);
      }
    } else {
      log('warning', 'Jellyfin adapter registration failed', { asset_id, status: res.status });
    }
  } catch (err: any) {
    log('warning', 'Jellyfin adapter unreachable', { asset_id, error: err.message });
  }

  log('info', 'Asset downloaded and registered', { asset_id, filename });
}

async function integrityCheck() {
  try {
    const assets = await getRandomLocalAssets(5);
    if (assets.length === 0) return;

    log('info', 'Running integrity check', { assetCount: assets.length });

    for (const asset of assets) {
      if (!asset.local_path || !asset.checksum) continue;

      try {
        const valid = await verifyChecksum(asset.local_path, asset.checksum);
        if (!valid) {
          log('error', 'Integrity check FAILED', {
            asset_id: asset.asset_id,
            filename: asset.filename,
          });
          queuedEvents.push({
            event_type: 'integrity_check_failed',
            severity: 'error',
            message: `Checksum mismatch for asset ${asset.asset_id} (${asset.filename})`,
            metadata: { asset_id: asset.asset_id },
          });
        }
      } catch {
        // File may be missing
        log('warning', 'Integrity check: file not found', { asset_id: asset.asset_id });
      }
    }
  } catch (err: any) {
    log('warning', 'Integrity check error', { error: err.message });
  }
}
