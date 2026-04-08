'use client';

import { useState, useEffect } from 'react';
import { createSupabaseBrowserClient } from '@/lib/supabase/browser';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Play, ExternalLink } from 'lucide-react';

interface PackageWithAssets {
  id: string;
  name: string;
  version: string;
  assets: { id: string; filename: string; jellyfin_item_id: string | null; mime_type: string | null }[];
}

export default function PlaybackTestPage() {
  const [packages, setPackages] = useState<PackageWithAssets[]>([]);
  const [loading, setLoading] = useState(true);
  const [streamError, setStreamError] = useState('');

  useEffect(() => {
    async function load() {
      const supabase = createSupabaseBrowserClient();

      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data: profile } = await supabase
        .from('users')
        .select('tenant_id')
        .eq('id', user.id)
        .single();

      if (!profile) return;

      // Fetch published packages with their assets
      const { data: pkgs } = await supabase
        .from('packages')
        .select('id, name, version')
        .eq('tenant_id', profile.tenant_id)
        .eq('status', 'published');

      if (!pkgs || pkgs.length === 0) {
        setLoading(false);
        return;
      }

      const packagesWithAssets: PackageWithAssets[] = [];

      for (const pkg of pkgs) {
        const { data: packageAssets } = await supabase
          .from('package_assets')
          .select('asset_id')
          .eq('package_id', pkg.id)
          .order('sort_order');

        if (!packageAssets || packageAssets.length === 0) {
          packagesWithAssets.push({ ...pkg, assets: [] });
          continue;
        }

        const assetIds = packageAssets.map((pa) => pa.asset_id);
        const { data: assets } = await supabase
          .from('assets')
          .select('id, filename, jellyfin_item_id, mime_type')
          .in('id', assetIds);

        packagesWithAssets.push({ ...pkg, assets: assets ?? [] });
      }

      setPackages(packagesWithAssets);
      setLoading(false);
    }

    load();
  }, []);

  async function handlePlay(assetId: string) {
    setStreamError('');
    try {
      const adapterUrl = process.env.NEXT_PUBLIC_JELLYFIN_ADAPTER_URL || 'http://localhost:3101';
      const res = await fetch(`${adapterUrl}/assets/${assetId}/stream-url?device_id=web-test`);
      if (!res.ok) {
        setStreamError(`Adapter returned ${res.status}`);
        return;
      }
      const data = await res.json();
      window.open(data.stream_url, '_blank');
    } catch (err) {
      setStreamError('Could not reach the Jellyfin adapter. Make sure it is running on the local network.');
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <p className="text-gray-400">Loading packages...</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-gray-100">Playback Test</h1>
      <p className="text-gray-400">
        Test end-to-end playback: Supabase → Jellyfin Adapter → Jellyfin stream.
      </p>

      {streamError && (
        <div className="rounded-md bg-red-500/10 border border-red-500/30 px-3 py-2 text-sm text-red-400">
          {streamError}
        </div>
      )}

      {packages.length === 0 ? (
        <Card>
          <CardContent className="py-10 text-center text-gray-500">
            No published packages found. Publish content first.
          </CardContent>
        </Card>
      ) : (
        packages.map((pkg) => (
          <Card key={pkg.id}>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle>{pkg.name}</CardTitle>
                <Badge variant="secondary">v{pkg.version}</Badge>
              </div>
            </CardHeader>
            <CardContent>
              {pkg.assets.length === 0 ? (
                <p className="text-gray-500 text-sm">No assets in this package.</p>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Filename</TableHead>
                      <TableHead>Type</TableHead>
                      <TableHead>Jellyfin ID</TableHead>
                      <TableHead className="w-24"></TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {pkg.assets.map((asset) => (
                      <TableRow key={asset.id}>
                        <TableCell className="font-medium">{asset.filename}</TableCell>
                        <TableCell className="text-xs">{asset.mime_type ?? '—'}</TableCell>
                        <TableCell className="font-mono text-xs">
                          {asset.jellyfin_item_id ?? <span className="text-gray-500">not mapped</span>}
                        </TableCell>
                        <TableCell>
                          {asset.jellyfin_item_id ? (
                            <Button size="sm" onClick={() => handlePlay(asset.id)}>
                              <Play className="mr-1 h-3 w-3" /> Play
                            </Button>
                          ) : (
                            <Badge variant="outline">No stream</Badge>
                          )}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        ))
      )}
    </div>
  );
}
