import { validateEnv } from './env';
import { initDb } from './db';
import { startWorker, stopWorker } from './worker';
import { startHealthServer, getHealthServer } from './health';
import { log } from './logger';

validateEnv();

async function main() {
  log('info', 'Pulse Sync Worker starting');

  try {
    await initDb();
  } catch (err: any) {
    log('error', 'Failed to initialize database, exiting', { error: err.message });
    process.exit(1);
  }

  startHealthServer();
  startWorker();

  let shutting = false;
  const shutdown = async (signal: string) => {
    if (shutting) return;
    shutting = true;
    log('info', 'Shutdown signal received', { signal });
    try { await stopWorker(); } catch {}
    const srv = getHealthServer();
    if (srv) srv.close();
    // Give stdio a tick to flush before exit.
    setTimeout(() => process.exit(0), 100).unref();
    setTimeout(() => process.exit(1), 15_000).unref();
  };
  process.on('SIGTERM', () => void shutdown('SIGTERM'));
  process.on('SIGINT', () => void shutdown('SIGINT'));
}

main();
