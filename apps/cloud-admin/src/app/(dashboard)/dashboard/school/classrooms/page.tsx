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
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Plus } from 'lucide-react';

export default function ClassroomsPage() {
  const [classrooms, setClassrooms] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [createOpen, setCreateOpen] = useState(false);
  const [nodes, setNodes] = useState<any[]>([]);
  const [siteId, setSiteId] = useState('');
  const [tenantId, setTenantId] = useState('');
  const [form, setForm] = useState({ name: '', room_code: '', node_id: '', capacity: '' });
  const [saving, setSaving] = useState(false);
  const [deviceCounts, setDeviceCounts] = useState<Record<string, number>>({});

  const supabase = createSupabaseBrowserClient();

  const load = useCallback(async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    const { data: profile } = await supabase.from('users').select('tenant_id, site_id').eq('id', user.id).single();
    if (!profile) return;
    setTenantId(profile.tenant_id);
    setSiteId(profile.site_id ?? '');

    const { data: cls } = await supabase
      .from('classrooms')
      .select('*, nodes(name)')
      .order('name');
    setClassrooms(cls ?? []);

    // Get device counts per classroom
    const counts: Record<string, number> = {};
    for (const c of cls ?? []) {
      const { count } = await supabase
        .from('devices')
        .select('id', { count: 'exact', head: true })
        .eq('classroom_id', c.id)
        .eq('status', 'enrolled');
      counts[c.id] = count ?? 0;
    }
    setDeviceCounts(counts);

    const { data: n } = await supabase.from('nodes').select('id, name').eq('tenant_id', profile.tenant_id).eq('status', 'active');
    setNodes(n ?? []);

    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  async function handleCreate() {
    setSaving(true);
    const res = await fetch('/api/classrooms', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...form, site_id: siteId, capacity: form.capacity ? parseInt(form.capacity) : null }),
    });
    if (res.ok) {
      setCreateOpen(false);
      setForm({ name: '', room_code: '', node_id: '', capacity: '' });
      load();
    }
    setSaving(false);
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-100">Classrooms</h1>
        <Dialog open={createOpen} onOpenChange={setCreateOpen}>
          <DialogTrigger asChild>
            <Button><Plus className="mr-2 h-4 w-4" /> Create Classroom</Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Create Classroom</DialogTitle>
              <DialogDescription>Add a new classroom to your site.</DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              <div className="space-y-2">
                <Label>Name</Label>
                <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="e.g. Room 101" />
              </div>
              <div className="space-y-2">
                <Label>Room Code</Label>
                <Input value={form.room_code} onChange={(e) => setForm({ ...form, room_code: e.target.value })} placeholder="e.g. R101" />
              </div>
              <div className="space-y-2">
                <Label>Assigned Node</Label>
                <Select value={form.node_id} onValueChange={(v) => setForm({ ...form, node_id: v })}>
                  <SelectTrigger><SelectValue placeholder="Select node" /></SelectTrigger>
                  <SelectContent>
                    {nodes.map((n) => <SelectItem key={n.id} value={n.id}>{n.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Capacity</Label>
                <Input type="number" value={form.capacity} onChange={(e) => setForm({ ...form, capacity: e.target.value })} placeholder="e.g. 30" />
              </div>
            </div>
            <DialogFooter>
              <Button onClick={handleCreate} disabled={saving || !form.name}>{saving ? 'Creating...' : 'Create'}</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Room Code</TableHead>
                <TableHead>Node</TableHead>
                <TableHead>Devices</TableHead>
                <TableHead>Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading && <TableRow><TableCell colSpan={5} className="text-center text-gray-500">Loading...</TableCell></TableRow>}
              {!loading && classrooms.length === 0 && <TableRow><TableCell colSpan={5} className="text-center text-gray-500">No classrooms yet</TableCell></TableRow>}
              {classrooms.map((c) => (
                <TableRow key={c.id}>
                  <TableCell>
                    <Link href={`/dashboard/school/classrooms/${c.id}`} className="text-brand-primary-light hover:underline font-medium">{c.name}</Link>
                  </TableCell>
                  <TableCell className="font-mono text-xs">{c.room_code ?? '—'}</TableCell>
                  <TableCell>{(c as any).nodes?.name ?? '—'}</TableCell>
                  <TableCell>{deviceCounts[c.id] ?? 0}</TableCell>
                  <TableCell><Badge variant={c.status === 'active' ? 'success' : 'secondary'}>{c.status}</Badge></TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
