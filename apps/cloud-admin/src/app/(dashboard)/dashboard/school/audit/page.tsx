'use client';

import { useState, useEffect, useCallback } from 'react';
import { createSupabaseBrowserClient } from '@/lib/supabase/browser';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Download } from 'lucide-react';

const EVENT_TYPES = [
  'node_registered', 'device_enrolled', 'device_revoked',
  'package_published', 'sync_completed', 'sync_failed',
  'user_invited', 'login', 'permission_change',
];

export default function AuditPage() {
  const [logs, setLogs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterType, setFilterType] = useState('');
  const [filterDateFrom, setFilterDateFrom] = useState('');
  const [filterDateTo, setFilterDateTo] = useState('');
  const supabase = createSupabaseBrowserClient();

  const load = useCallback(async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    const { data: profile } = await supabase.from('users').select('tenant_id').eq('id', user.id).single();
    if (!profile) return;

    let query = supabase
      .from('audit_logs')
      .select('*, users(email, full_name)')
      .eq('tenant_id', profile.tenant_id)
      .order('created_at', { ascending: false })
      .limit(200);

    if (filterType) query = query.eq('event_type', filterType);
    if (filterDateFrom) query = query.gte('created_at', filterDateFrom);
    if (filterDateTo) query = query.lte('created_at', filterDateTo + 'T23:59:59Z');

    const { data } = await query;
    setLogs(data ?? []);
    setLoading(false);
  }, [filterType, filterDateFrom, filterDateTo]);

  useEffect(() => { load(); }, [load]);

  function exportCsv() {
    const headers = ['Timestamp', 'User', 'Event Type', 'Entity Type', 'Entity ID', 'Description', 'IP Address'];
    const rows = logs.map((l) => [
      l.created_at,
      (l as any).users?.email ?? l.user_id ?? '',
      l.event_type,
      l.entity_type ?? '',
      l.entity_id ?? '',
      l.description ?? '',
      l.ip_address ?? '',
    ]);

    const csv = [headers.join(','), ...rows.map((r) => r.map((c: string) => `"${(c ?? '').replace(/"/g, '""')}"`).join(','))].join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `audit-logs-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-100">Audit Log</h1>
        <Button variant="outline" onClick={exportCsv} disabled={logs.length === 0}>
          <Download className="mr-2 h-4 w-4" /> Export CSV
        </Button>
      </div>

      {/* Filters */}
      <div className="flex gap-3 flex-wrap">
        <select
          value={filterType}
          onChange={(e) => setFilterType(e.target.value)}
          className="rounded-md border border-gray-600 bg-brand-bg px-3 py-1.5 text-sm text-gray-200"
        >
          <option value="">All events</option>
          {EVENT_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
        </select>
        <Input type="date" value={filterDateFrom} onChange={(e) => setFilterDateFrom(e.target.value)} className="max-w-[160px]" placeholder="From" />
        <Input type="date" value={filterDateTo} onChange={(e) => setFilterDateTo(e.target.value)} className="max-w-[160px]" placeholder="To" />
      </div>

      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Timestamp</TableHead>
                <TableHead>User</TableHead>
                <TableHead>Event</TableHead>
                <TableHead>Entity</TableHead>
                <TableHead>Description</TableHead>
                <TableHead>IP</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading && <TableRow><TableCell colSpan={6} className="text-center text-gray-500">Loading...</TableCell></TableRow>}
              {!loading && logs.length === 0 && <TableRow><TableCell colSpan={6} className="text-center text-gray-500">No audit logs</TableCell></TableRow>}
              {logs.map((l) => (
                <TableRow key={l.id}>
                  <TableCell className="text-xs whitespace-nowrap">{new Date(l.created_at).toLocaleString()}</TableCell>
                  <TableCell className="text-sm">{(l as any).users?.email ?? '—'}</TableCell>
                  <TableCell><span className="font-mono text-xs bg-brand-bg px-1.5 py-0.5 rounded">{l.event_type}</span></TableCell>
                  <TableCell className="text-xs">{l.entity_type ? `${l.entity_type}/${l.entity_id?.slice(0, 8)}` : '—'}</TableCell>
                  <TableCell className="text-sm max-w-xs truncate">{l.description ?? '—'}</TableCell>
                  <TableCell className="font-mono text-xs">{l.ip_address ?? '—'}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
