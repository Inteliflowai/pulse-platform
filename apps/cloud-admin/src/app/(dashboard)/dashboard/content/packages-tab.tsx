'use client';

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { createSupabaseBrowserClient } from '@/lib/supabase/browser';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter, DialogDescription } from '@/components/ui/dialog';
import { Plus } from 'lucide-react';

interface Pkg {
  id: string;
  name: string;
  version: string;
  status: string;
  total_size_bytes: number;
  created_at: string;
  asset_count?: number;
}

interface Asset {
  id: string;
  filename: string;
  size_bytes: number | null;
  mime_type: string | null;
  checksum: string | null;
  storage_path: string | null;
}

interface Site {
  id: string;
  name: string;
}

function statusBadge(status: string) {
  const map: Record<string, 'success' | 'warning' | 'secondary'> = {
    published: 'success', draft: 'warning', deprecated: 'secondary',
  };
  return <Badge variant={map[status] ?? 'secondary'}>{status}</Badge>;
}

function formatBytes(bytes: number | null) {
  if (!bytes) return '—';
  if (bytes < 1048576) return `${(bytes / 1024).toFixed(1)} KB`;
  if (bytes < 1073741824) return `${(bytes / 1048576).toFixed(1)} MB`;
  return `${(bytes / 1073741824).toFixed(2)} GB`;
}

export function PackagesTab() {
  const [packages, setPackages] = useState<Pkg[]>([]);
  const [loading, setLoading] = useState(true);
  const [createOpen, setCreateOpen] = useState(false);
  const [tenantId, setTenantId] = useState('');
  const [userId, setUserId] = useState('');
  const [userEmail, setUserEmail] = useState('');

  const supabase = createSupabaseBrowserClient();

  const loadPackages = useCallback(async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    setUserId(user.id);
    setUserEmail(user.email ?? '');
    const { data: profile } = await supabase.from('users').select('tenant_id').eq('id', user.id).single();
    if (!profile) return;
    setTenantId(profile.tenant_id);

    const { data: pkgs } = await supabase
      .from('packages')
      .select('*')
      .eq('tenant_id', profile.tenant_id)
      .order('created_at', { ascending: false });

    // Get asset counts
    const result: Pkg[] = [];
    for (const pkg of pkgs ?? []) {
      const { count } = await supabase
        .from('package_assets')
        .select('id', { count: 'exact', head: true })
        .eq('package_id', pkg.id);
      result.push({ ...pkg, asset_count: count ?? 0 });
    }

    setPackages(result);
    setLoading(false);
  }, []);

  useEffect(() => { loadPackages(); }, [loadPackages]);

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <p className="text-sm text-gray-400">{packages.length} package(s)</p>
        <Dialog open={createOpen} onOpenChange={setCreateOpen}>
          <DialogTrigger asChild>
            <Button><Plus className="mr-2 h-4 w-4" /> Create Package</Button>
          </DialogTrigger>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle>Create Package</DialogTitle>
              <DialogDescription>Bundle assets into a deliverable package for school nodes.</DialogDescription>
            </DialogHeader>
            <CreatePackageForm
              tenantId={tenantId}
              userId={userId}
              userEmail={userEmail}
              onComplete={() => { setCreateOpen(false); loadPackages(); }}
            />
          </DialogContent>
        </Dialog>
      </div>

      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Version</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Assets</TableHead>
                <TableHead>Size</TableHead>
                <TableHead>Created</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading && (
                <TableRow><TableCell colSpan={6} className="text-center text-gray-500">Loading...</TableCell></TableRow>
              )}
              {!loading && packages.length === 0 && (
                <TableRow><TableCell colSpan={6} className="text-center text-gray-500">No packages yet</TableCell></TableRow>
              )}
              {packages.map((pkg) => (
                <TableRow key={pkg.id}>
                  <TableCell>
                    <Link href={`/dashboard/content/packages/${pkg.id}`} className="text-brand-primary hover:underline font-medium">
                      {pkg.name}
                    </Link>
                  </TableCell>
                  <TableCell className="font-mono text-xs">{pkg.version}</TableCell>
                  <TableCell>{statusBadge(pkg.status)}</TableCell>
                  <TableCell>{pkg.asset_count}</TableCell>
                  <TableCell>{formatBytes(pkg.total_size_bytes)}</TableCell>
                  <TableCell className="text-xs">{new Date(pkg.created_at).toLocaleDateString()}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}

function CreatePackageForm({ tenantId, userId, userEmail, onComplete }: {
  tenantId: string; userId: string; userEmail: string; onComplete: () => void;
}) {
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [version, setVersion] = useState('1.0.0');
  const [allAssets, setAllAssets] = useState<Asset[]>([]);
  const [selectedAssetIds, setSelectedAssetIds] = useState<Set<string>>(new Set());
  const [allSites, setAllSites] = useState<Site[]>([]);
  const [selectedSiteIds, setSelectedSiteIds] = useState<Set<string>>(new Set());
  const [search, setSearch] = useState('');
  const [saving, setSaving] = useState(false);

  const supabase = createSupabaseBrowserClient();

  useEffect(() => {
    supabase.from('assets').select('id, filename, size_bytes, mime_type, checksum, storage_path')
      .eq('tenant_id', tenantId).eq('status', 'ready').order('filename')
      .then(({ data }) => setAllAssets(data ?? []));

    supabase.from('sites').select('id, name')
      .eq('tenant_id', tenantId).order('name')
      .then(({ data }) => setAllSites(data ?? []));
  }, [tenantId]);

  function toggleAsset(id: string) {
    setSelectedAssetIds((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  }

  function toggleSite(id: string) {
    setSelectedSiteIds((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  }

  const filteredAssets = allAssets.filter((a) =>
    a.filename.toLowerCase().includes(search.toLowerCase())
  );

  async function handleCreate() {
    setSaving(true);
    const selected = allAssets.filter((a) => selectedAssetIds.has(a.id));
    const totalSize = selected.reduce((sum, a) => sum + (a.size_bytes ?? 0), 0);

    const manifest = {
      version,
      package_id: '', // will be set after insert
      publisher: userEmail,
      created_at: new Date().toISOString(),
      assets: selected.map((a, i) => ({
        asset_id: a.id,
        filename: a.filename,
        size_bytes: a.size_bytes ?? 0,
        checksum: a.checksum ?? '',
        storage_path: a.storage_path ?? '',
        mime_type: a.mime_type ?? '',
        sort_order: i,
      })),
    };

    const { data: pkg, error: pkgErr } = await supabase
      .from('packages')
      .insert({
        tenant_id: tenantId,
        created_by: userId,
        name,
        description,
        version,
        status: 'draft',
        target_sites: Array.from(selectedSiteIds),
        total_size_bytes: totalSize,
        manifest: { ...manifest, package_id: 'pending' },
      })
      .select('id')
      .single();

    if (pkgErr || !pkg) { setSaving(false); return; }

    // Update manifest with package_id
    await supabase.from('packages').update({
      manifest: { ...manifest, package_id: pkg.id },
    }).eq('id', pkg.id);

    // Insert package_assets
    const rows = selected.map((a, i) => ({
      package_id: pkg.id,
      asset_id: a.id,
      sort_order: i,
    }));

    if (rows.length > 0) {
      await supabase.from('package_assets').insert(rows);
    }

    setSaving(false);
    onComplete();
  }

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label>Name</Label>
          <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Science Grade 10" />
        </div>
        <div className="space-y-2">
          <Label>Version</Label>
          <Input value={version} onChange={(e) => setVersion(e.target.value)} />
        </div>
      </div>
      <div className="space-y-2">
        <Label>Description</Label>
        <Input value={description} onChange={(e) => setDescription(e.target.value)} placeholder="What's in this package?" />
      </div>

      {/* Asset picker */}
      <div className="space-y-2">
        <Label>Assets ({selectedAssetIds.size} selected)</Label>
        <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search assets..." />
        <div className="max-h-48 overflow-auto rounded border border-gray-700 bg-brand-bg">
          {filteredAssets.map((a) => (
            <label key={a.id} className="flex items-center gap-2 px-3 py-1.5 hover:bg-brand-surface cursor-pointer text-sm">
              <input
                type="checkbox"
                checked={selectedAssetIds.has(a.id)}
                onChange={() => toggleAsset(a.id)}
                className="rounded"
              />
              <span className="truncate text-gray-200">{a.filename}</span>
              <span className="text-xs text-gray-500 ml-auto">{formatBytes(a.size_bytes)}</span>
            </label>
          ))}
          {filteredAssets.length === 0 && (
            <p className="text-xs text-gray-500 p-3">No assets found</p>
          )}
        </div>
      </div>

      {/* Site targets */}
      <div className="space-y-2">
        <Label>Target Sites ({selectedSiteIds.size} selected — all if none)</Label>
        <div className="flex flex-wrap gap-2">
          {allSites.map((s) => (
            <button
              key={s.id}
              onClick={() => toggleSite(s.id)}
              className={`rounded-md border px-3 py-1 text-xs transition-colors ${
                selectedSiteIds.has(s.id)
                  ? 'border-brand-primary bg-brand-primary/20 text-brand-primary'
                  : 'border-gray-600 text-gray-400 hover:text-gray-200'
              }`}
            >
              {s.name}
            </button>
          ))}
        </div>
      </div>

      <DialogFooter>
        <Button onClick={handleCreate} disabled={saving || !name || selectedAssetIds.size === 0}>
          {saving ? 'Creating...' : 'Create Package'}
        </Button>
      </DialogFooter>
    </div>
  );
}
