import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'fs';
import { dirname, basename } from 'path';
import { JellyfinClient } from './jellyfin-client';

const MAP_FILE = 'data/jellyfin-map.json';

type AssetMap = Record<string, string>; // pulseAssetId -> jellyfinItemId

export class PulseAssetMapper {
  private map: AssetMap;

  constructor(private jellyfin: JellyfinClient) {
    this.map = this.loadMap();
  }

  private loadMap(): AssetMap {
    try {
      if (existsSync(MAP_FILE)) {
        return JSON.parse(readFileSync(MAP_FILE, 'utf-8'));
      }
    } catch {
      // corrupt file, reset
    }
    return {};
  }

  private saveMap(): void {
    const dir = dirname(MAP_FILE);
    if (!existsSync(dir)) {
      mkdirSync(dir, { recursive: true });
    }
    writeFileSync(MAP_FILE, JSON.stringify(this.map, null, 2));
  }

  get mappedCount(): number {
    return Object.keys(this.map).length;
  }

  async registerAsset(pulseAssetId: string, localFilePath: string): Promise<{ jellyfinItemId: string; streamUrl: string }> {
    // Check if already mapped
    if (this.map[pulseAssetId]) {
      const streamUrl = await this.jellyfin.getStreamUrl(this.map[pulseAssetId], 'pulse-adapter');
      return { jellyfinItemId: this.map[pulseAssetId], streamUrl };
    }

    // Trigger library refresh
    const libraries = await this.jellyfin.getLibraries();
    for (const lib of libraries) {
      if (lib.ItemId) {
        await this.jellyfin.refreshLibrary(lib.ItemId);
      }
    }

    // Poll for the item — use recursive item listing with Path field
    // and match by the file path or filename within the path
    let jellyfinItemId: string | null = null;
    const filename = basename(localFilePath.replace(/\\/g, '/'));
    // Normalize: Jellyfin uses backslashes on Windows paths
    const normalizedPath = localFilePath.replace(/\//g, '\\');

    for (let attempt = 0; attempt < 30; attempt++) {
      await new Promise((r) => setTimeout(r, 2000));

      // Search all items recursively, match by path containing our asset ID or filename
      const allItems = await this.jellyfin.getAllItems();
      for (const item of allItems) {
        if (!item.Path) continue;
        // Match by pulseAssetId in path (UUID folder) or exact filename
        if (item.Path.includes(pulseAssetId) || item.Path.endsWith(filename) || item.Path.endsWith(normalizedPath.split('\\').pop() ?? '')) {
          jellyfinItemId = item.Id;
          break;
        }
      }

      if (jellyfinItemId) break;

      // Re-trigger refresh every 10 attempts
      if (attempt > 0 && attempt % 10 === 0) {
        for (const lib of libraries) {
          if (lib.ItemId) await this.jellyfin.refreshLibrary(lib.ItemId);
        }
      }
    }

    if (!jellyfinItemId) {
      throw new Error(`Jellyfin did not index file "${filename}" within timeout`);
    }

    // Save mapping
    this.map[pulseAssetId] = jellyfinItemId;
    this.saveMap();

    const streamUrl = await this.jellyfin.getStreamUrl(jellyfinItemId, 'pulse-adapter');
    return { jellyfinItemId, streamUrl };
  }

  async getStreamUrl(pulseAssetId: string, deviceId: string): Promise<string> {
    const jellyfinItemId = this.map[pulseAssetId];
    if (!jellyfinItemId) {
      throw new Error(`No Jellyfin mapping for asset ${pulseAssetId}`);
    }
    return this.jellyfin.getStreamUrl(jellyfinItemId, deviceId);
  }

  async deregisterAsset(pulseAssetId: string): Promise<void> {
    const jellyfinItemId = this.map[pulseAssetId];
    if (jellyfinItemId) {
      try {
        await this.jellyfin.deleteItem(jellyfinItemId);
      } catch {
        // Item may already be gone
      }
      delete this.map[pulseAssetId];
      this.saveMap();
    }
  }
}
