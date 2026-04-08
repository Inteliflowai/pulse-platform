import express from 'express';
import { JellyfinClient } from './jellyfin-client';
import { PulseAssetMapper } from './asset-mapper';

const PORT = parseInt(process.env.PORT ?? '3101', 10);
const JELLYFIN_BASE_URL = process.env.JELLYFIN_BASE_URL ?? 'http://jellyfin:8096';
const JELLYFIN_API_KEY = process.env.JELLYFIN_API_KEY ?? '';
const NODE_ID = process.env.NODE_ID ?? '';

const app = express();
app.use(express.json());

const jellyfin = new JellyfinClient(JELLYFIN_BASE_URL, JELLYFIN_API_KEY);
const mapper = new PulseAssetMapper(jellyfin);

function log(level: string, message: string, meta?: Record<string, any>) {
  console.log(JSON.stringify({ timestamp: new Date().toISOString(), level, service: 'jellyfin-adapter', node_id: NODE_ID, message, ...meta }));
}

// Health check
app.get('/health', async (_req, res) => {
  let jellyfinReachable = false;
  let jellyfinVersion = '';

  try {
    const info = await jellyfin.getSystemInfo();
    jellyfinReachable = true;
    jellyfinVersion = info.Version ?? '';
  } catch {
    // unreachable
  }

  res.json({
    ok: true,
    jellyfin_reachable: jellyfinReachable,
    jellyfin_version: jellyfinVersion,
    mapped_assets_count: mapper.mappedCount,
  });
});

// Register asset in Jellyfin
app.post('/assets/register', async (req, res) => {
  const { pulse_asset_id, local_file_path } = req.body;

  if (!pulse_asset_id || !local_file_path) {
    res.status(400).json({ error: 'Missing pulse_asset_id or local_file_path' });
    return;
  }

  try {
    log('info', 'Registering asset', { pulse_asset_id, local_file_path });
    const result = await mapper.registerAsset(pulse_asset_id, local_file_path);
    log('info', 'Asset registered', { pulse_asset_id, jellyfin_item_id: result.jellyfinItemId });
    res.json({ jellyfin_item_id: result.jellyfinItemId, stream_url: result.streamUrl });
  } catch (err: any) {
    log('error', 'Asset registration failed', { pulse_asset_id, error: err.message });
    res.status(500).json({ error: err.message });
  }
});

// Get stream URL for an asset
app.get('/assets/:pulseAssetId/stream-url', async (req, res) => {
  const { pulseAssetId } = req.params;
  const deviceId = (req.query.device_id as string) || 'default';

  try {
    const streamUrl = await mapper.getStreamUrl(pulseAssetId, deviceId);
    res.json({ stream_url: streamUrl });
  } catch (err: any) {
    log('error', 'Stream URL lookup failed', { pulse_asset_id: pulseAssetId, error: err.message });
    res.status(404).json({ error: err.message });
  }
});

// Deregister asset
app.delete('/assets/:pulseAssetId', async (req, res) => {
  const { pulseAssetId } = req.params;

  try {
    await mapper.deregisterAsset(pulseAssetId);
    log('info', 'Asset deregistered', { pulse_asset_id: pulseAssetId });
    res.json({ ok: true });
  } catch (err: any) {
    log('error', 'Asset deregistration failed', { pulse_asset_id: pulseAssetId, error: err.message });
    res.status(500).json({ error: err.message });
  }
});

// Refresh library
app.post('/library/refresh', async (_req, res) => {
  try {
    const libraries = await jellyfin.getLibraries();
    for (const lib of libraries) {
      if (lib.ItemId) {
        await jellyfin.refreshLibrary(lib.ItemId);
      }
    }
    log('info', 'Library refresh triggered');
    res.json({ ok: true });
  } catch (err: any) {
    log('error', 'Library refresh failed', { error: err.message });
    res.status(500).json({ error: err.message });
  }
});

// Start server
app.listen(PORT, async () => {
  log('info', `Jellyfin Adapter listening on port ${PORT}`);

  // Verify Jellyfin is reachable on startup
  try {
    const info = await jellyfin.getSystemInfo();
    log('info', `Connected to Jellyfin ${info.Version}`, { jellyfin_version: info.Version, server_name: info.ServerName });
  } catch (err: any) {
    log('warning', `Jellyfin not reachable at startup: ${err.message}. Will retry on requests.`);
  }
});
