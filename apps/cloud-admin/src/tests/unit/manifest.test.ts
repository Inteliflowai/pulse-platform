import { describe, it, expect } from 'vitest';

/**
 * Tests for package manifest building logic.
 * This is a pure function test — the manifest builder logic is inline.
 */

interface ManifestAsset {
  asset_id: string;
  filename: string;
  size_bytes: number;
  checksum: string;
  storage_path: string;
}

interface PackageManifest {
  version: string;
  assets: ManifestAsset[];
  created_at: string;
  publisher: string;
}

function buildPackageManifest(
  assets: ManifestAsset[],
  version: string,
  publisher: string
): PackageManifest {
  return {
    version,
    assets: assets.map((a) => ({
      asset_id: a.asset_id,
      filename: a.filename,
      size_bytes: a.size_bytes,
      checksum: a.checksum,
      storage_path: a.storage_path,
    })),
    created_at: new Date().toISOString(),
    publisher,
  };
}

const sampleAssets: ManifestAsset[] = [
  { asset_id: 'a1', filename: 'video.mp4', size_bytes: 100000, checksum: 'abc123', storage_path: 't/a1/video.mp4' },
  { asset_id: 'a2', filename: 'doc.pdf', size_bytes: 50000, checksum: 'def456', storage_path: 't/a2/doc.pdf' },
];

describe('buildPackageManifest()', () => {
  it('includes all assets in manifest assets array', () => {
    const manifest = buildPackageManifest(sampleAssets, '1.0.0', 'admin@test.edu');
    expect(manifest.assets).toHaveLength(2);
  });

  it('includes checksum for each asset', () => {
    const manifest = buildPackageManifest(sampleAssets, '1.0.0', 'admin@test.edu');
    manifest.assets.forEach((a) => {
      expect(a.checksum).toBeDefined();
      expect(typeof a.checksum).toBe('string');
    });
  });

  it('includes size_bytes for each asset', () => {
    const manifest = buildPackageManifest(sampleAssets, '1.0.0', 'admin@test.edu');
    expect(manifest.assets[0].size_bytes).toBe(100000);
    expect(manifest.assets[1].size_bytes).toBe(50000);
  });

  it('includes storage_path for each asset', () => {
    const manifest = buildPackageManifest(sampleAssets, '1.0.0', 'admin@test.edu');
    expect(manifest.assets[0].storage_path).toBe('t/a1/video.mp4');
  });

  it('sets version from package.version', () => {
    const manifest = buildPackageManifest(sampleAssets, '2.0.0', 'admin@test.edu');
    expect(manifest.version).toBe('2.0.0');
  });

  it('sets publisher from user email', () => {
    const manifest = buildPackageManifest(sampleAssets, '1.0.0', 'teacher@school.edu');
    expect(manifest.publisher).toBe('teacher@school.edu');
  });

  it('sets created_at as ISO string', () => {
    const manifest = buildPackageManifest(sampleAssets, '1.0.0', 'admin@test.edu');
    expect(manifest.created_at).toMatch(/^\d{4}-\d{2}-\d{2}T/);
  });

  it('handles empty assets array', () => {
    const manifest = buildPackageManifest([], '1.0.0', 'admin@test.edu');
    expect(manifest.assets).toHaveLength(0);
    expect(manifest.version).toBe('1.0.0');
  });
});
