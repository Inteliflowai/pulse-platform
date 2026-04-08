'use client';

import { useState, useEffect, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { createSupabaseBrowserClient } from '@/lib/supabase/browser';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { ArrowLeft, Send } from 'lucide-react';
import Link from 'next/link';

function statusBadge(status: string) {
  const map: Record<string, 'success' | 'warning' | 'destructive' | 'secondary'> = {
    published: 'success', draft: 'warning', deprecated: 'secondary',
    completed: 'success', in_progress: 'warning', failed: 'destructive', pending: 'secondary',
    ready: 'success', error: 'destructive',
  };
  return <Badge variant={map[status] ?? 'secondary'}>{status}</Badge>;
}

function formatBytes(bytes: number | null) {
  if (!bytes) return '—';
  if (bytes < 1048576) return `${(bytes / 1024).toFixed(1)} KB`;
  if (bytes < 1073741824) return `${(bytes / 1048576).toFixed(1)} MB`;
  return `${(bytes / 1073741824).toFixed(2)} GB`;
}

export default function PackageDetailPage() {
  const { packageId } = useParams<{ packageId: string }>();
  const router = useRouter();
  const supabase = createSupabaseBrowserClient();

  const [pkg, setPkg] = useState<any>(null);
  const [assets, setAssets] = useState<any[]>([]);
  const [syncJobs, setSyncJobs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [publishing, setPublishing] = useState(false);
  const [pushing, setPushing] = useState(false);

  const load = useCallback(async () => {
    const { data: p } = await supabase.from('packages').select('*').eq('id', packageId).single();
    setPkg(p);

    const { data: pa } = await supabase
      .from('package_assets')
      .select('sort_order, assets(id, filename, mime_type, size_bytes, status, checksum)')
      .eq('package_id', packageId)
      .order('sort_order');
    setAssets((pa ?? []).map((r: any) => ({ ...r.assets, sort_order: r.sort_order })));

    const { data: jobs } = await supabase
      .from('sync_jobs')
      .select('*, nodes(name)')
      .eq('package_id', packageId)
      .order('created_at', { ascending: false });
    setSyncJobs(jobs ?? []);

    setLoading(false);
  }, [packageId]);

  useEffect(() => { load(); }, [load]);

  async function handlePublish() {
    setPublishing(true);
    const { data: { user } } = await supabase.auth.getUser();

    // Rebuild manifest with final data
    const manifest = {
      version: pkg.version,
      package_id: pkg.id,
      publisher: user?.email ?? '',
      created_at: new Date().toISOString(),
      assets: assets.map((a) => ({
        asset_id: a.id,
        filename: a.filename,
        size_bytes: a.size_bytes ?? 0,
        checksum: a.checksum ?? '',
        storage_path: `${pkg.tenant_id}/${a.id}/${a.filename}`,
        mime_type: a.mime_type ?? '',
        sort_order: a.sort_order,
      })),
    };

    await supabase.from('packages').update({ status: 'published', manifest }).eq('id', pkg.id);

    // Audit log
    await supabase.from('audit_logs').insert({
      tenant_id: pkg.tenant_id,
      user_id: user?.id,
      event_type: 'package_published',
      entity_type: 'package',
      entity_id: pkg.id,
      description: `Package "${pkg.name}" v${pkg.version} published`,
    });

    setPublishing(false);
    load();
  }

  async function handleDeprecate() {
    await supabase.from('packages').update({ status: 'deprecated' }).eq('id', pkg.id);
    load();
  }

  async function handlePushSync() {
    setPushing(true);
    await fetch('/api/sync/enqueue', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ package_id: pkg.id }),
    });
    setPushing(false);
    load();
  }

  if (loading) {
    return <div className="text-gray-400 py-20 text-center">Loading package...</div>;
  }

  if (!pkg) {
    return <div className="text-gray-400 py-20 text-center">Package not found</div>;
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <Link href="/dashboard/content" className="text-gray-400 hover:text-gray-200">
          <ArrowLeft className="h-5 w-5" />
        </Link>
        <h1 className="text-2xl font-bold text-gray-100">{pkg.name}</h1>
        {statusBadge(pkg.status)}
      </div>

      {/* Metadata */}
      <Card>
        <CardHeader>
          <CardTitle>Package Details</CardTitle>
          {pkg.description && <CardDescription>{pkg.description}</CardDescription>}
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
            <div><span className="text-gray-400 block">Version</span><span className="font-mono">{pkg.version}</span></div>
            <div><span className="text-gray-400 block">Total Size</span>{formatBytes(pkg.total_size_bytes)}</div>
            <div><span className="text-gray-400 block">Assets</span>{assets.length}</div>
            <div><span className="text-gray-400 block">Created</span>{new Date(pkg.created_at).toLocaleDateString()}</div>
          </div>

          <div className="flex gap-2 mt-6">
            {pkg.status === 'draft' && (
              <Button onClick={handlePublish} disabled={publishing}>
                {publishing ? 'Publishing...' : 'Publish'}
              </Button>
            )}
            {pkg.status === 'published' && (
              <>
                <Button onClick={handlePushSync} disabled={pushing}>
                  <Send className="mr-2 h-4 w-4" /> {pushing ? 'Pushing...' : 'Push Sync'}
                </Button>
                <Button variant="destructive" onClick={handleDeprecate}>Deprecate</Button>
              </>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Assets */}
      <Card>
        <CardHeader><CardTitle>Assets</CardTitle></CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>#</TableHead>
                <TableHead>Filename</TableHead>
                <TableHead>Type</TableHead>
                <TableHead>Size</TableHead>
                <TableHead>Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {assets.map((a, i) => (
                <TableRow key={a.id}>
                  <TableCell>{i + 1}</TableCell>
                  <TableCell className="font-medium">{a.filename}</TableCell>
                  <TableCell className="text-xs">{a.mime_type ?? '—'}</TableCell>
                  <TableCell>{formatBytes(a.size_bytes)}</TableCell>
                  <TableCell>{statusBadge(a.status)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Sync status */}
      <Card>
        <CardHeader><CardTitle>Sync Status</CardTitle></CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Node</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Progress</TableHead>
                <TableHead>Started</TableHead>
                <TableHead>Completed</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {syncJobs.length === 0 && (
                <TableRow><TableCell colSpan={5} className="text-center text-gray-500">No sync jobs for this package</TableCell></TableRow>
              )}
              {syncJobs.map((job: any) => (
                <TableRow key={job.id}>
                  <TableCell>{job.nodes?.name ?? '—'}</TableCell>
                  <TableCell>{statusBadge(job.status)}</TableCell>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <div className="h-1.5 w-16 rounded-full bg-gray-700">
                        <div className="h-1.5 rounded-full bg-brand-primary" style={{ width: `${Math.min(job.progress_pct, 100)}%` }} />
                      </div>
                      <span className="text-xs">{job.progress_pct}%</span>
                    </div>
                  </TableCell>
                  <TableCell className="text-xs">{job.started_at ? new Date(job.started_at).toLocaleString() : '—'}</TableCell>
                  <TableCell className="text-xs">{job.completed_at ? new Date(job.completed_at).toLocaleString() : '—'}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
