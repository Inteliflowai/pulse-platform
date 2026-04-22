import { log } from './logger';

const CLOUD_API_URL = process.env.CLOUD_API_URL ?? '';
const NODE_ID = process.env.NODE_ID ?? '';
const NODE_TOKEN = process.env.NODE_REGISTRATION_TOKEN ?? '';

export async function fetchPendingJobs(): Promise<any[]> {
  const res = await fetch(`${CLOUD_API_URL}/api/sync/node-jobs/${NODE_ID}`, {
    headers: { 'X-Node-Token': NODE_TOKEN },
  });
  if (!res.ok) throw new Error(`Failed to fetch jobs: ${res.status}`);
  const data: any = await res.json();
  return data.jobs ?? [];
}

export async function reportProgress(jobId: string, bytesTransferred: number, progressPct: number, status?: string) {
  const body: any = { bytes_transferred: bytesTransferred, progress_pct: progressPct };
  if (status) body.status = status;

  const res = await fetch(`${CLOUD_API_URL}/api/sync/jobs/${jobId}/progress`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });

  if (!res.ok) log('warning', 'Failed to report progress', { jobId, status: res.status });
}

export async function reportComplete(jobId: string, status: 'completed' | 'failed', errorMessage?: string) {
  const res = await fetch(`${CLOUD_API_URL}/api/sync/jobs/${jobId}/complete`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ status, error_message: errorMessage }),
  });

  if (!res.ok) log('warning', 'Failed to report completion', { jobId, status: res.status });
}

export async function getDownloadUrl(assetId: string): Promise<{ url: string; expires_at: string }> {
  const res = await fetch(`${CLOUD_API_URL}/api/assets/${assetId}/download-url`, {
    headers: { 'X-Node-Token': NODE_TOKEN },
  });

  if (!res.ok) throw new Error(`Failed to get download URL: ${res.status}`);
  return res.json() as Promise<{ url: string; expires_at: string }>;
}

export async function sendNodeEvents(events: any[]) {
  const res = await fetch(`${CLOUD_API_URL}/api/nodes/${NODE_ID}/events`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ events }),
  });

  if (!res.ok) log('warning', 'Failed to send node events', { status: res.status });
}
