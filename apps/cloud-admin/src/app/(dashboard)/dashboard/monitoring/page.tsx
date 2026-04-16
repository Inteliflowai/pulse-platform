'use client';

import { useState, useEffect, useCallback } from 'react';
import { createSupabaseBrowserClient } from '@/lib/supabase/browser';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Input } from '@/components/ui/input';
import { AlertTriangle, AlertCircle, Info, Server, Wifi, HardDrive } from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, ResponsiveContainer, Tooltip } from 'recharts';

function severityIcon(severity: string) {
  if (severity === 'critical') return <AlertCircle className="h-4 w-4 text-red-400" />;
  if (severity === 'warning') return <AlertTriangle className="h-4 w-4 text-yellow-400" />;
  return <Info className="h-4 w-4 text-blue-400" />;
}

function gauge(label: string, value: number, max: number, unit: string) {
  const pct = max > 0 ? (value / max) * 100 : 0;
  const color = pct > 90 ? 'bg-red-400' : pct > 70 ? 'bg-yellow-400' : 'bg-emerald-400';
  return (
    <div className="space-y-1">
      <div className="flex justify-between text-xs"><span className="text-gray-400">{label}</span><span>{value.toFixed(1)}{unit} / {max.toFixed(1)}{unit}</span></div>
      <div className="h-2 rounded-full bg-gray-700"><div className={`h-2 rounded-full ${color} transition-all`} style={{ width: `${Math.min(pct, 100)}%` }} /></div>
    </div>
  );
}

export default function SchoolMonitoringPage() {
  const [node, setNode] = useState<any>(null);
  const [latestMetric, setLatestMetric] = useState<any>(null);
  const [syncJobs, setSyncJobs] = useState<any[]>([]);
  const [events, setEvents] = useState<any[]>([]);
  const [alerts, setAlerts] = useState<any[]>([]);
  const [sessionsByHour, setSessionsByHour] = useState<any[]>([]);
  const [deviceCounts, setDeviceCounts] = useState({ enrolled: 0, revoked: 0, pending: 0 });
  const [loading, setLoading] = useState(true);
  const [filterSeverity, setFilterSeverity] = useState('');
  const [eventsPage, setEventsPage] = useState(0);
  const supabase = createSupabaseBrowserClient();

  const load = useCallback(async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    const { data: profile } = await supabase.from('users').select('tenant_id').eq('id', user.id).single();
    if (!profile) return;

    // Get first active node for this tenant
    const { data: nodes } = await supabase.from('nodes').select('*').eq('tenant_id', profile.tenant_id).limit(1);
    const n = nodes?.[0];
    setNode(n);

    if (n) {
      // Latest metric
      const { data: m } = await supabase.from('node_metrics').select('*').eq('node_id', n.id).order('recorded_at', { ascending: false }).limit(1);
      setLatestMetric(m?.[0] ?? null);

      // Sync jobs
      const { data: sj } = await supabase.from('sync_jobs').select('*, packages(name)').eq('node_id', n.id).order('created_at', { ascending: false }).limit(10);
      setSyncJobs(sj ?? []);

      // Alerts (24h)
      const dayAgo = new Date(Date.now() - 86400000).toISOString();
      const { data: al } = await supabase.from('node_events').select('*').eq('node_id', n.id).in('severity', ['warning', 'critical']).gte('created_at', dayAgo).order('created_at', { ascending: false });
      setAlerts(al ?? []);

      // All events (paginated)
      let evQuery = supabase.from('node_events').select('*').eq('node_id', n.id).order('created_at', { ascending: false }).range(eventsPage * 50, (eventsPage + 1) * 50 - 1);
      if (filterSeverity) evQuery = evQuery.eq('severity', filterSeverity);
      const { data: ev } = await evQuery;
      setEvents(ev ?? []);

      // Sessions by hour (last 24h)
      const { data: sessions } = await supabase.from('playback_sessions').select('started_at').eq('node_id', n.id).gte('started_at', dayAgo);
      const hourMap: Record<number, number> = {};
      for (let i = 0; i < 24; i++) hourMap[i] = 0;
      for (const s of sessions ?? []) {
        const h = new Date(s.started_at).getHours();
        hourMap[h] = (hourMap[h] ?? 0) + 1;
      }
      setSessionsByHour(Object.entries(hourMap).map(([h, c]) => ({ hour: `${h}:00`, count: c })));
    }

    // Device counts
    const { data: devs } = await supabase.from('devices').select('status').eq('tenant_id', profile.tenant_id);
    const counts = { enrolled: 0, revoked: 0, pending: 0 };
    for (const d of devs ?? []) {
      if (d.status === 'enrolled') counts.enrolled++;
      else if (d.status === 'revoked') counts.revoked++;
      else counts.pending++;
    }
    setDeviceCounts(counts);
    setLoading(false);
  }, [filterSeverity, eventsPage]);

  useEffect(() => { load(); const i = setInterval(load, 30000); return () => clearInterval(i); }, [load]);

  if (loading) return <div className="text-gray-400 py-20 text-center">Loading monitoring...</div>;

  const completedToday = syncJobs.filter((j) => j.status === 'completed' && new Date(j.completed_at).toDateString() === new Date().toDateString()).length;
  const failedToday = syncJobs.filter((j) => j.status === 'failed' && new Date(j.completed_at ?? j.updated_at).toDateString() === new Date().toDateString()).length;
  const lastSync = syncJobs.find((j) => j.status === 'completed');

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-gray-100">Monitoring</h1>

      <div className="grid gap-4 lg:grid-cols-2">
        {/* Node Health */}
        <Card>
          <CardHeader><CardTitle className="flex items-center gap-2"><Server className="h-4 w-4" />Node Health</CardTitle></CardHeader>
          <CardContent className="space-y-3">
            {node ? (
              <>
                <div className="flex items-center justify-between text-sm">
                  <span className="text-gray-400">Status</span>
                  <Badge variant={node.status === 'active' ? 'success' : 'destructive'}>{node.status}</Badge>
                </div>
                <div className="flex items-center justify-between text-sm"><span className="text-gray-400">Version</span><span className="font-mono">{node.version ?? '—'}</span></div>
                <div className="flex items-center justify-between text-sm"><span className="text-gray-400">Last Heartbeat</span><span>{node.last_seen_at ? new Date(node.last_seen_at).toLocaleString() : '—'}</span></div>
                {latestMetric && (
                  <div className="space-y-2 pt-2">
                    {gauge('CPU', latestMetric.cpu_pct ?? 0, 100, '%')}
                    {gauge('Memory', latestMetric.memory_used_gb ?? 0, latestMetric.memory_total_gb ?? 1, ' GB')}
                    {gauge('Storage', latestMetric.storage_used_gb ?? 0, latestMetric.storage_total_gb ?? 1, ' GB')}
                  </div>
                )}
              </>
            ) : <p className="text-gray-500">No node configured</p>}
          </CardContent>
        </Card>

        {/* Sync Activity */}
        <Card>
          <CardHeader><CardTitle>Sync Activity</CardTitle></CardHeader>
          <CardContent className="space-y-3">
            {syncJobs.filter((j) => j.status === 'in_progress').map((j) => (
              <div key={j.id} className="space-y-1">
                <div className="flex justify-between text-sm"><span>{(j as any).packages?.name}</span><span>{j.progress_pct}%</span></div>
                <div className="h-1.5 rounded-full bg-gray-700"><div className="h-1.5 rounded-full bg-brand-primary transition-all" style={{ width: `${j.progress_pct}%` }} /></div>
              </div>
            ))}
            <div className="grid grid-cols-3 gap-2 pt-2 text-center">
              <div><span className="block text-2xl font-bold text-emerald-400">{completedToday}</span><span className="text-xs text-gray-500">Completed Today</span></div>
              <div><span className="block text-2xl font-bold text-red-400">{failedToday}</span><span className="text-xs text-gray-500">Failed Today</span></div>
              <div className="text-left"><span className="text-xs text-gray-400 block">Last Sync</span><span className="text-xs">{lastSync?.completed_at ? new Date(lastSync.completed_at).toLocaleString() : '—'}</span></div>
            </div>
          </CardContent>
        </Card>

        {/* Sessions */}
        <Card>
          <CardHeader><CardTitle>Sessions (24h)</CardTitle></CardHeader>
          <CardContent>
            <div className="h-40">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={sessionsByHour}>
                  <XAxis dataKey="hour" tick={{ fill: '#9ca3af', fontSize: 10 }} interval={3} />
                  <YAxis tick={{ fill: '#9ca3af', fontSize: 10 }} allowDecimals={false} />
                  <Tooltip contentStyle={{ background: '#1e2130', border: '1px solid #374151', borderRadius: 8, fontSize: 12 }} />
                  <Bar dataKey="count" fill="#6366f1" radius={[2, 2, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        {/* Devices */}
        <Card>
          <CardHeader><CardTitle>Devices</CardTitle></CardHeader>
          <CardContent>
            <div className="grid grid-cols-3 gap-4 text-center">
              <div><span className="block text-2xl font-bold text-emerald-400">{deviceCounts.enrolled}</span><span className="text-xs text-gray-500">Enrolled</span></div>
              <div><span className="block text-2xl font-bold text-red-400">{deviceCounts.revoked}</span><span className="text-xs text-gray-500">Revoked</span></div>
              <div><span className="block text-2xl font-bold text-gray-400">{deviceCounts.pending}</span><span className="text-xs text-gray-500">Pending</span></div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Alerts */}
      {alerts.length > 0 && (
        <Card>
          <CardHeader><CardTitle>Alerts (24h)</CardTitle></CardHeader>
          <CardContent className="p-0">
            <Table>
              <TableHeader><TableRow><TableHead className="w-10"></TableHead><TableHead>Event</TableHead><TableHead>Message</TableHead><TableHead>Time</TableHead></TableRow></TableHeader>
              <TableBody>
                {alerts.map((a) => (
                  <TableRow key={a.id}><TableCell>{severityIcon(a.severity)}</TableCell><TableCell className="font-mono text-xs">{a.event_type}</TableCell><TableCell className="text-sm">{a.message}</TableCell><TableCell className="text-xs">{new Date(a.created_at).toLocaleString()}</TableCell></TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}

      {/* Events log */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle>Node Events</CardTitle>
            <select value={filterSeverity} onChange={(e) => { setFilterSeverity(e.target.value); setEventsPage(0); }} className="rounded border border-gray-600 bg-brand-bg px-2 py-1 text-xs text-gray-200">
              <option value="">All severities</option>
              <option value="info">Info</option>
              <option value="warning">Warning</option>
              <option value="error">Error</option>
              <option value="critical">Critical</option>
            </select>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader><TableRow><TableHead className="w-10"></TableHead><TableHead>Event</TableHead><TableHead>Message</TableHead><TableHead>Time</TableHead></TableRow></TableHeader>
            <TableBody>
              {events.length === 0 && <TableRow><TableCell colSpan={4} className="text-center text-gray-500">No events</TableCell></TableRow>}
              {events.map((e) => (
                <TableRow key={e.id}><TableCell>{severityIcon(e.severity)}</TableCell><TableCell className="font-mono text-xs">{e.event_type}</TableCell><TableCell className="text-sm">{e.message ?? '—'}</TableCell><TableCell className="text-xs whitespace-nowrap">{new Date(e.created_at).toLocaleString()}</TableCell></TableRow>
              ))}
            </TableBody>
          </Table>
          <div className="flex justify-center gap-2 p-3">
            {eventsPage > 0 && <button onClick={() => setEventsPage(eventsPage - 1)} className="text-xs text-brand-primary-light">Previous</button>}
            {events.length === 50 && <button onClick={() => setEventsPage(eventsPage + 1)} className="text-xs text-brand-primary-light">Next</button>}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
