const NODE_ID = process.env.NODE_ID ?? '';

export function log(level: string, message: string, meta?: Record<string, any>) {
  console.log(JSON.stringify({
    timestamp: new Date().toISOString(),
    level,
    service: 'sync-worker',
    node_id: NODE_ID,
    message,
    ...meta,
  }));
}
