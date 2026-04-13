import { validateEnv } from './env';
import { initDb } from './db';
import { startWorker } from './worker';
import { startHealthServer } from './health';
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
}

main();
