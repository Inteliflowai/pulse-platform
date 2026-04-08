'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { createSupabaseBrowserClient } from '@/lib/supabase/browser';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogDescription } from '@/components/ui/dialog';
import { Upload, X, File, Trash2, Download } from 'lucide-react';

interface Asset {
  id: string;
  filename: string;
  original_filename: string | null;
  mime_type: string | null;
  size_bytes: number | null;
  status: string;
  checksum: string | null;
  storage_path: string | null;
  created_at: string;
}

function formatBytes(bytes: number | null) {
  if (!bytes) return '—';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1048576) return `${(bytes / 1024).toFixed(1)} KB`;
  if (bytes < 1073741824) return `${(bytes / 1048576).toFixed(1)} MB`;
  return `${(bytes / 1073741824).toFixed(2)} GB`;
}

function statusBadge(status: string) {
  const map: Record<string, 'success' | 'warning' | 'destructive' | 'secondary'> = {
    ready: 'success', processing: 'warning', pending: 'secondary', error: 'destructive', deprecated: 'secondary',
  };
  return <Badge variant={map[status] ?? 'secondary'}>{status}</Badge>;
}

export function AssetsTab() {
  const [assets, setAssets] = useState<Asset[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploadOpen, setUploadOpen] = useState(false);
  const [drawerAsset, setDrawerAsset] = useState<Asset | null>(null);
  const [tenantId, setTenantId] = useState('');

  const supabase = createSupabaseBrowserClient();

  const loadAssets = useCallback(async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    const { data: profile } = await supabase.from('users').select('tenant_id').eq('id', user.id).single();
    if (!profile) return;
    setTenantId(profile.tenant_id);

    const { data } = await supabase
      .from('assets')
      .select('*')
      .eq('tenant_id', profile.tenant_id)
      .order('created_at', { ascending: false });
    setAssets(data ?? []);
    setLoading(false);
  }, []);

  useEffect(() => { loadAssets(); }, [loadAssets]);

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <p className="text-sm text-gray-400">{assets.length} asset(s)</p>
        <Dialog open={uploadOpen} onOpenChange={setUploadOpen}>
          <DialogTrigger asChild>
            <Button><Upload className="mr-2 h-4 w-4" /> Upload</Button>
          </DialogTrigger>
          <DialogContent className="max-w-lg">
            <DialogHeader>
              <DialogTitle>Upload Assets</DialogTitle>
              <DialogDescription>Drag and drop files or click to browse. Max 4GB per file.</DialogDescription>
            </DialogHeader>
            <UploadZone tenantId={tenantId} onComplete={() => { setUploadOpen(false); loadAssets(); }} />
          </DialogContent>
        </Dialog>
      </div>

      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Filename</TableHead>
                <TableHead>Type</TableHead>
                <TableHead>Size</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Uploaded</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading && (
                <TableRow><TableCell colSpan={5} className="text-center text-gray-500">Loading...</TableCell></TableRow>
              )}
              {!loading && assets.length === 0 && (
                <TableRow><TableCell colSpan={5} className="text-center text-gray-500">No assets uploaded yet</TableCell></TableRow>
              )}
              {assets.map((asset) => (
                <TableRow key={asset.id} className="cursor-pointer" onClick={() => setDrawerAsset(asset)}>
                  <TableCell className="font-medium flex items-center gap-2">
                    <File className="h-4 w-4 text-gray-500" />
                    {asset.filename}
                  </TableCell>
                  <TableCell className="text-xs">{asset.mime_type ?? '—'}</TableCell>
                  <TableCell>{formatBytes(asset.size_bytes)}</TableCell>
                  <TableCell>{statusBadge(asset.status)}</TableCell>
                  <TableCell className="text-xs">{new Date(asset.created_at).toLocaleDateString()}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Asset detail drawer */}
      {drawerAsset && (
        <AssetDrawer asset={drawerAsset} onClose={() => setDrawerAsset(null)} onDelete={() => { setDrawerAsset(null); loadAssets(); }} />
      )}
    </div>
  );
}

function UploadZone({ tenantId, onComplete }: { tenantId: string; onComplete: () => void }) {
  const [files, setFiles] = useState<File[]>([]);
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState<Record<string, number>>({});
  const fileInputRef = useRef<HTMLInputElement>(null);
  const supabase = createSupabaseBrowserClient();

  function handleDrop(e: React.DragEvent) {
    e.preventDefault();
    const dropped = Array.from(e.dataTransfer.files);
    setFiles((prev) => [...prev, ...dropped]);
  }

  function handleFileSelect(e: React.ChangeEvent<HTMLInputElement>) {
    if (e.target.files) setFiles((prev) => [...prev, ...Array.from(e.target.files!)]);
  }

  async function handleUpload() {
    setUploading(true);
    const { data: { user } } = await supabase.auth.getUser();

    for (const file of files) {
      const assetId = crypto.randomUUID();
      const storagePath = `${tenantId}/${assetId}/${file.name}`;

      // Create asset row
      await supabase.from('assets').insert({
        id: assetId,
        tenant_id: tenantId,
        uploaded_by: user?.id,
        filename: file.name,
        original_filename: file.name,
        mime_type: file.type || 'application/octet-stream',
        size_bytes: file.size,
        storage_path: storagePath,
        status: 'pending',
      });

      setProgress((p) => ({ ...p, [file.name]: 0 }));

      // Upload file
      const { error: uploadErr } = await supabase.storage
        .from('pulse-assets')
        .upload(storagePath, file, {
          cacheControl: '3600',
          upsert: false,
        });

      if (uploadErr) {
        await supabase.from('assets').update({ status: 'error' }).eq('id', assetId);
        setProgress((p) => ({ ...p, [file.name]: -1 }));
        continue;
      }

      // Compute checksum
      const buffer = await file.arrayBuffer();
      const hashBuffer = await crypto.subtle.digest('SHA-256', buffer);
      const checksum = Array.from(new Uint8Array(hashBuffer)).map((b) => b.toString(16).padStart(2, '0')).join('');

      // Update asset row
      await supabase.from('assets').update({
        status: 'ready',
        checksum,
        size_bytes: file.size,
      }).eq('id', assetId);

      setProgress((p) => ({ ...p, [file.name]: 100 }));
    }

    setUploading(false);
    onComplete();
  }

  return (
    <div className="space-y-4">
      <div
        onDrop={handleDrop}
        onDragOver={(e) => e.preventDefault()}
        onClick={() => fileInputRef.current?.click()}
        className="border-2 border-dashed border-gray-600 rounded-lg p-8 text-center cursor-pointer hover:border-brand-primary transition-colors"
      >
        <Upload className="h-8 w-8 mx-auto text-gray-500 mb-2" />
        <p className="text-sm text-gray-400">Drop files here or click to browse</p>
        <p className="text-xs text-gray-500 mt-1">video/*, image/*, PDF, JSON — max 4GB</p>
        <input
          ref={fileInputRef}
          type="file"
          multiple
          accept="video/*,image/*,application/pdf,application/json"
          className="hidden"
          onChange={handleFileSelect}
        />
      </div>

      {files.length > 0 && (
        <div className="space-y-2">
          {files.map((f, i) => (
            <div key={i} className="flex items-center justify-between rounded bg-brand-bg px-3 py-2">
              <div className="flex items-center gap-2 min-w-0">
                <File className="h-4 w-4 text-gray-500 flex-shrink-0" />
                <span className="text-sm truncate">{f.name}</span>
                <span className="text-xs text-gray-500">{formatBytes(f.size)}</span>
              </div>
              <div className="flex items-center gap-2">
                {progress[f.name] != null && progress[f.name] >= 0 && (
                  <div className="w-20 h-1.5 rounded-full bg-gray-700">
                    <div className="h-1.5 rounded-full bg-brand-primary transition-all" style={{ width: `${progress[f.name]}%` }} />
                  </div>
                )}
                {progress[f.name] === -1 && <span className="text-xs text-red-400">Error</span>}
                {!uploading && (
                  <button onClick={() => setFiles((prev) => prev.filter((_, j) => j !== i))} className="text-gray-500 hover:text-gray-300">
                    <X className="h-4 w-4" />
                  </button>
                )}
              </div>
            </div>
          ))}
          <Button onClick={handleUpload} disabled={uploading} className="w-full">
            {uploading ? 'Uploading...' : `Upload ${files.length} file(s)`}
          </Button>
        </div>
      )}
    </div>
  );
}

function AssetDrawer({ asset, onClose, onDelete }: { asset: Asset; onClose: () => void; onDelete: () => void }) {
  const [downloadUrl, setDownloadUrl] = useState('');
  const [deleting, setDeleting] = useState(false);
  const supabase = createSupabaseBrowserClient();

  async function handleDownload() {
    if (!asset.storage_path) return;
    const { data } = await supabase.storage.from('pulse-assets').createSignedUrl(asset.storage_path, 3600);
    if (data?.signedUrl) {
      setDownloadUrl(data.signedUrl);
      window.open(data.signedUrl, '_blank');
    }
  }

  async function handleDelete() {
    setDeleting(true);
    if (asset.storage_path) {
      await supabase.storage.from('pulse-assets').remove([asset.storage_path]);
    }
    await supabase.from('assets').delete().eq('id', asset.id);
    setDeleting(false);
    onDelete();
  }

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{asset.filename}</DialogTitle>
          <DialogDescription>Asset details</DialogDescription>
        </DialogHeader>
        <div className="space-y-3 text-sm">
          {[
            ['ID', asset.id],
            ['MIME Type', asset.mime_type],
            ['Size', formatBytes(asset.size_bytes)],
            ['Status', asset.status],
            ['Checksum', asset.checksum],
            ['Storage Path', asset.storage_path],
            ['Created', new Date(asset.created_at).toLocaleString()],
          ].map(([label, value]) => (
            <div key={label as string} className="flex justify-between border-b border-gray-700 pb-1">
              <span className="text-gray-400">{label}</span>
              <span className="text-gray-200 text-right max-w-[60%] truncate font-mono text-xs">{value ?? '—'}</span>
            </div>
          ))}
        </div>
        <div className="flex gap-2 mt-4">
          <Button variant="outline" onClick={handleDownload} className="flex-1">
            <Download className="mr-2 h-4 w-4" /> Download
          </Button>
          <Button variant="destructive" onClick={handleDelete} disabled={deleting} className="flex-1">
            <Trash2 className="mr-2 h-4 w-4" /> {deleting ? 'Deleting...' : 'Delete'}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
