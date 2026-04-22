import { createServer, IncomingMessage, ServerResponse, type Server } from 'http';
import { getDiskFreeGb } from './downloader';
import { getWorkerState } from './worker';
import { log } from './logger';

const PORT = parseInt(process.env.HEALTH_PORT ?? '3200', 10);
const MEDIA_DIR = process.env.MEDIA_DIR ?? '/data/media';

let _server: Server | null = null;
export function getHealthServer(): Server | null { return _server; }

export function startHealthServer() {
  const server = createServer((req: IncomingMessage, res: ServerResponse) => {
    if (req.url === '/health' && req.method === 'GET') {
      const state = getWorkerState();
      const diskFreeGb = getDiskFreeGb(MEDIA_DIR);

      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({
        ok: true,
        wan_connected: state.wanConnected,
        active_jobs: state.activeJobs,
        queued_jobs: 0,
        last_sync_at: state.lastSyncAt,
        disk_free_gb: parseFloat(diskFreeGb.toFixed(2)),
      }));
    } else {
      res.writeHead(404);
      res.end();
    }
  });

  server.listen(PORT, () => {
    log('info', `Health server listening on port ${PORT}`);
  });
  _server = server;
}
