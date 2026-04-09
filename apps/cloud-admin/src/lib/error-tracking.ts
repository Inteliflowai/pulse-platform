/**
 * Lightweight error tracking — logs to console in structured format.
 * Replace with Sentry or similar in production by swapping this module.
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
