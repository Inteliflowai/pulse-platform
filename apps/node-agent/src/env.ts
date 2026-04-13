/**
 * Validate required environment variables on startup.
 * Fails fast with a clear message if any are missing.
 */

const REQUIRED = ['NODE_ID', 'CLOUD_API_URL'];
const RECOMMENDED = ['NODE_REGISTRATION_TOKEN', 'JELLYFIN_ADAPTER_URL'];

export function validateEnv() {
  const missing: string[] = [];
  const warnings: string[] = [];

  for (const key of REQUIRED) {
    if (!process.env[key]) missing.push(key);
  }

  for (const key of RECOMMENDED) {
    if (!process.env[key]) warnings.push(key);
  }

  if (warnings.length > 0) {
    console.warn(`[env] Missing recommended vars: ${warnings.join(', ')}`);
  }

  if (missing.length > 0) {
    console.error(`[env] FATAL: Missing required environment variables: ${missing.join(', ')}`);
    console.error('[env] Set these in your .env file and restart.');
    process.exit(1);
  }
}
