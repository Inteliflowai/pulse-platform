'use client';

import { useState, useEffect, useCallback } from 'react';
import { createSupabaseBrowserClient } from '@/lib/supabase/browser';
import { cn } from '@/lib/utils';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Ban } from 'lucide-react';

const tabs = [
  { key: 'devices', label: 'All Devices' },
  { key: 'codes', label: 'Enrollment Codes' },
] as const;

type TabKey = (typeof tabs)[number]['key'];

function statusBadge(status: string) {
  const map: Record<string, 'success' | 'warning' | 'destructive' | 'secondary'> = {
    enrolled: 'success', pending: 'warning', revoked: 'destructive',
  };
  return <Badge variant={map[status] ?? 'secondary'}>{status}</Badge>;
}

export default function DevicesPage() {
  const [tab, setTab] = useState<TabKey>('devices');
  const [devices, setDevices] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [filterStatus, setFilterStatus] = useState('');
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const supabase = createSupabaseBrowserClient();

  const load = useCallback(async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    const { data: profile } = await supabase.from('users').select('tenant_id').eq('id', user.id).single();
    if (!profile) return;

    const { data } = await supabase
      .from('devices')
      .select('*, classrooms(name)')
      .eq('tenant_id', profile.tenant_id)
      .order('created_at', { ascending: false });
    setDevices(data ?? []);
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  async function revokeDevice(id: string) {
    await fetch(`/api/devices/${id}/revoke`, { method: 'POST' });
    load();
  }

  async function bulkRevoke() {
    for (const id of selected) {
      await fetch(`/api/devices/${id}/revoke`, { method: 'POST' });
    }
    setSelected(new Set());
    load();
  }

  const enrolledDevices = devices.filter((d) => d.status !== 'pending' || d.enrollment_token);
  const pendingCodes = devices.filter((d) => d.status === 'pending');

  const filteredDevices = enrolledDevices.filter((d) => {
    if (search && !d.name.toLowerCase().includes(search.toLowerCase()) && !(d as any).classrooms?.name?.toLowerCase().includes(search.toLowerCase())) return false;
    if (filterStatus && d.status !== filterStatus) return false;
    return true;
  });

  function toggleSelect(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  }

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-gray-100">Devices</h1>

      <div className="flex border-b border-gray-700">
        {tabs.map((t) => (
          <button key={t.key} onClick={() => setTab(t.key)} className={cn(
            'px-4 py-2 text-sm font-medium border-b-2 -mb-px transition-colors',
            tab === t.key ? 'border-brand-primary text-brand-primary' : 'border-transparent text-gray-400 hover:text-gray-200'
          )}>{t.label}</button>
        ))}
      </div>

      {tab === 'devices' && (
        <div className="space-y-4">
          <div className="flex gap-2">
            <Input placeholder="Search by name or classroom..." value={search} onChange={(e) => setSearch(e.target.value)} className="max-w-xs" />
            <select value={filterStatus} onChange={(e) => setFilterStatus(e.target.value)}
              className="rounded-md border border-gray-600 bg-brand-bg px-3 py-1 text-sm text-gray-200">
              <option value="">All statuses</option>
              <option value="enrolled">Enrolled</option>
              <option value="revoked">Revoked</option>
              <option value="pending">Pending</option>
            </select>
            {selected.size > 0 && (
              <Button variant="destructive" size="sm" onClick={bulkRevoke}>
                <Ban className="mr-1 h-3 w-3" /> Revoke {selected.size}
              </Button>
            )}
          </div>
          <Card>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-8"></TableHead>
                    <TableHead>Name</TableHead>
                    <TableHead>Type</TableHead>
                    <TableHead>Classroom</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Last Seen</TableHead>
                    <TableHead>IP</TableHead>
                    <TableHead>Enrolled</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {loading && <TableRow><TableCell colSpan={8} className="text-center text-gray-500">Loading...</TableCell></TableRow>}
                  {!loading && filteredDevices.length === 0 && <TableRow><TableCell colSpan={8} className="text-center text-gray-500">No devices</TableCell></TableRow>}
                  {filteredDevices.map((d) => (
                    <TableRow key={d.id}>
                      <TableCell><input type="checkbox" checked={selected.has(d.id)} onChange={() => toggleSelect(d.id)} /></TableCell>
                      <TableCell className="font-medium">{d.name}</TableCell>
                      <TableCell className="text-xs">{d.device_type}</TableCell>
                      <TableCell>{(d as any).classrooms?.name ?? '—'}</TableCell>
                      <TableCell>{statusBadge(d.status)}</TableCell>
                      <TableCell className="text-xs">{d.last_seen_at ? new Date(d.last_seen_at).toLocaleString() : '—'}</TableCell>
                      <TableCell className="font-mono text-xs">{d.ip_address ?? '—'}</TableCell>
                      <TableCell className="text-xs">{new Date(d.created_at).toLocaleDateString()}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </div>
      )}

      {tab === 'codes' && (
        <Card>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Code</TableHead>
                  <TableHead>Classroom</TableHead>
                  <TableHead>Created</TableHead>
                  <TableHead>Expires</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="w-20"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {pendingCodes.length === 0 && <TableRow><TableCell colSpan={6} className="text-center text-gray-500">No pending codes</TableCell></TableRow>}
                {pendingCodes.map((d) => {
                  const meta = d.metadata as any;
                  const expired = meta?.expires_at && new Date(meta.expires_at) < new Date();
                  return (
                    <TableRow key={d.id}>
                      <TableCell className="font-mono text-xs">{d.enrollment_token?.slice(0, 8)}...{d.enrollment_token?.slice(-4)}</TableCell>
                      <TableCell>{(d as any).classrooms?.name ?? '—'}</TableCell>
                      <TableCell className="text-xs">{new Date(d.created_at).toLocaleString()}</TableCell>
                      <TableCell className="text-xs">{meta?.expires_at ? new Date(meta.expires_at).toLocaleString() : '—'}</TableCell>
                      <TableCell>{expired ? <Badge variant="destructive">Expired</Badge> : <Badge variant="warning">Pending</Badge>}</TableCell>
                      <TableCell>
                        <button onClick={() => revokeDevice(d.id)} className="text-red-400 hover:text-red-300 text-xs">Revoke</button>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
