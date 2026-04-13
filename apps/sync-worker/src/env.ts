const REQUIRED = ['NODE_ID', 'CLOUD_API_URL', 'NODE_REGISTRATION_TOKEN'];
const RECOMMENDED = ['JELLYFIN_ADAPTER_URL', 'MEDIA_DIR', 'SYNC_DATA_DIR'];

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
    process.exit(1);
  }
}
