import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'fs';
import { dirname } from 'path';
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
    // Trigger a library refresh so Jellyfin picks up the file
    const libraries = await this.jellyfin.getLibraries();
    for (const lib of libraries) {
      if (lib.ItemId) {
        await this.jellyfin.refreshLibrary(lib.ItemId);
      }
    }

    // Poll until the item appears (max 30 seconds)
    let jellyfinItemId: string | null = null;
    const filename = localFilePath.split('/').pop() ?? localFilePath;

    for (let i = 0; i < 15; i++) {
      await new Promise((r) => setTimeout(r, 2000));

      const items = await this.jellyfin.getItemsByPath(filename);
      if (items.length > 0) {
        jellyfinItemId = items[0].Id;
        break;
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
