'use client';

import { useState, useEffect, useCallback } from 'react';
import { createSupabaseBrowserClient } from '@/lib/supabase/browser';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter, DialogDescription } from '@/components/ui/dialog';
import { Plus, Send } from 'lucide-react';

function statusBadge(status: string) {
  const map: Record<string, 'success' | 'warning' | 'destructive' | 'secondary'> = { released: 'success', staged: 'warning', draft: 'secondary', deprecated: 'destructive' };
  return <Badge variant={map[status] ?? 'secondary'}>{status}</Badge>;
}

export default function ReleasesPage() {
  const [releases, setReleases] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [createOpen, setCreateOpen] = useState(false);
  const [form, setForm] = useState({ version: '', release_notes: '', download_url: '', checksum: '' });
  const [saving, setSaving] = useState(false);
  const supabase = createSupabaseBrowserClient();

  const load = useCallback(async () => {
    const { data } = await supabase.from('software_releases').select('*').order('created_at', { ascending: false });
    setReleases(data ?? []);
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  async function handleCreate() {
    setSaving(true);
    await supabase.from('software_releases').insert({ ...form, status: 'draft' });
    setCreateOpen(false);
    setForm({ version: '', release_notes: '', download_url: '', checksum: '' });
    setSaving(false);
    load();
  }

  async function setStatus(id: string, status: string) {
    const update: any = { status };
    if (status === 'released') update.released_at = new Date().toISOString();
    await supabase.from('software_releases').update(update).eq('id', id);
    load();
  }

  async function pushToNodes(releaseId: string) {
    const { data: nodes } = await supabase.from('nodes').select('id').eq('status', 'active');
    for (const node of nodes ?? []) {
      await supabase.from('software_update_assignments').upsert(
        { release_id: releaseId, node_id: node.id, status: 'pending' },
        { onConflict: 'id' }
      );
    }
    alert(`Pushed to ${(nodes ?? []).length} node(s)`);
  }

  const nextStatus: Record<string, string> = { draft: 'staged', staged: 'released', released: 'deprecated' };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-100">Software Releases</h1>
        <Dialog open={createOpen} onOpenChange={setCreateOpen}>
          <DialogTrigger asChild><Button><Plus className="mr-2 h-4 w-4" /> Create Release</Button></DialogTrigger>
          <DialogContent>
            <DialogHeader><DialogTitle>Create Release</DialogTitle><DialogDescription>Add a new software version.</DialogDescription></DialogHeader>
            <div className="space-y-3">
              <div className="space-y-1"><Label>Version</Label><Input value={form.version} onChange={(e) => setForm({ ...form, version: e.target.value })} placeholder="e.g. 0.2.0" /></div>
              <div className="space-y-1"><Label>Release Notes</Label><textarea value={form.release_notes} onChange={(e) => setForm({ ...form, release_notes: e.target.value })} className="w-full rounded-md border border-gray-600 bg-brand-bg px-3 py-2 text-sm text-gray-100 min-h-[80px]" /></div>
              <div className="space-y-1"><Label>Download URL</Label><Input value={form.download_url} onChange={(e) => setForm({ ...form, download_url: e.target.value })} placeholder="https://..." /></div>
              <div className="space-y-1"><Label>Checksum (SHA-256)</Label><Input value={form.checksum} onChange={(e) => setForm({ ...form, checksum: e.target.value })} /></div>
            </div>
            <DialogFooter><Button onClick={handleCreate} disabled={saving || !form.version}>{saving ? 'Creating...' : 'Create'}</Button></DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader><TableRow><TableHead>Version</TableHead><TableHead>Status</TableHead><TableHead>Released</TableHead><TableHead>Notes</TableHead><TableHead className="w-48">Actions</TableHead></TableRow></TableHeader>
            <TableBody>
              {loading && <TableRow><TableCell colSpan={5} className="text-center text-gray-500">Loading...</TableCell></TableRow>}
              {!loading && releases.length === 0 && <TableRow><TableCell colSpan={5} className="text-center text-gray-500">No releases</TableCell></TableRow>}
              {releases.map((r) => (
                <TableRow key={r.id}>
                  <TableCell className="font-mono font-medium">{r.version}</TableCell>
                  <TableCell>{statusBadge(r.status)}</TableCell>
                  <TableCell className="text-xs">{r.released_at ? new Date(r.released_at).toLocaleString() : '—'}</TableCell>
                  <TableCell className="text-sm max-w-xs truncate">{r.release_notes?.slice(0, 80) ?? '—'}</TableCell>
                  <TableCell>
                    <div className="flex gap-1">
                      {nextStatus[r.status] && <Button size="sm" variant="outline" onClick={() => setStatus(r.id, nextStatus[r.status])}>{nextStatus[r.status]}</Button>}
                      {r.status === 'released' && <Button size="sm" onClick={() => pushToNodes(r.id)}><Send className="mr-1 h-3 w-3" />Push</Button>}
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
