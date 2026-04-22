/**
 * Lightweight error tracking.
 *
 * - Always writes a structured JSON line to stderr so log aggregators pick it up.
 * - Optionally POSTs to ERROR_WEBHOOK_URL (Slack, Discord, or a Sentry-like ingest).
 *   Delivery is fire-and-forget with a short timeout and a small in-memory rate limit
 *   so a flaky sink never blocks request handling or amplifies an outage.
 *
 * Upgrade path: if you need structured aggregation, replace the webhook sink with
 * @sentry/nextjs — the `trackError` signature stays the same.
 */

interface ErrorEvent {
  message: string;
  stack?: string;
  context?: Record<string, unknown>;
  url?: string;
  userId?: string;
  timestamp: string;
  severity: 'error' | 'warning' | 'info';
}

const errorBuffer: ErrorEvent[] = [];
const MAX_BUFFER = 100;

// Rate limit: at most N webhook deliveries per window, to protect against error storms.
const WEBHOOK_MAX_PER_MINUTE = 30;
const webhookTimestamps: number[] = [];

async function deliverToWebhook(event: ErrorEvent) {
  const url = process.env.ERROR_WEBHOOK_URL;
  if (!url) return;

  const now = Date.now();
  while (webhookTimestamps.length > 0 && now - webhookTimestamps[0] > 60_000) {
    webhookTimestamps.shift();
  }
  if (webhookTimestamps.length >= WEBHOOK_MAX_PER_MINUTE) return;
  webhookTimestamps.push(now);

  try {
    await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ source: 'pulse-cloud-admin', ...event }),
      signal: AbortSignal.timeout(2000),
    });
  } catch {
    // Sink is best-effort; do not let a failed webhook poison the original request.
  }
}

export function trackError(error: Error | string, context?: Record<string, unknown>, severity: 'error' | 'warning' | 'info' = 'error') {
  const event: ErrorEvent = {
    message: typeof error === 'string' ? error : error.message,
    stack: typeof error === 'string' ? undefined : error.stack,
    context,
    timestamp: new Date().toISOString(),
    severity,
  };

  console.error(JSON.stringify({ type: 'ERROR_TRACKED', ...event }));

  errorBuffer.push(event);
  if (errorBuffer.length > MAX_BUFFER) errorBuffer.shift();

  void deliverToWebhook(event);
}

export function getRecentErrors(): ErrorEvent[] {
  return [...errorBuffer];
}

export function clearErrors(): void {
  errorBuffer.length = 0;
}

// For API routes: wrap handler with error tracking
export function withErrorTracking(handler: Function) {
  return async (...args: any[]) => {
    try {
      return await handler(...args);
    } catch (error: any) {
      trackError(error, { handler: handler.name });
      throw error;
    }
  };
}
