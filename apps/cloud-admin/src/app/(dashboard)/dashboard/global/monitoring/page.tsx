'use client';

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { createSupabaseBrowserClient } from '@/lib/supabase/browser';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Server, Activity, HardDrive, AlertTriangle, AlertCircle, Info } from 'lucide-react';
import { LineChart, Line, ResponsiveContainer, Tooltip } from 'recharts';

function severityIcon(severity: string) {
  if (severity === 'critical') return <AlertCircle className="h-4 w-4 text-red-400" />;
  if (severity === 'error') return <AlertTriangle className="h-4 w-4 text-red-400" />;
  if (severity === 'warning') return <AlertTriangle className="h-4 w-4 text-yellow-400" />;
  return <Info className="h-4 w-4 text-blue-400" />;
}

function relativeTime(date: string) {
  const diff = Date.now() - new Date(date).getTime();
  if (diff < 60000) return `${Math.floor(diff / 1000)}s ago`;
  if (diff < 3600000) return `${Math.floor(diff / 60000)}m ago`;
  if (diff < 86400000) return `${Math.floor(diff / 3600000)}h ago`;
  return `${Math.floor(diff / 86400000)}d ago`;
}

export default function GlobalMonitoringPage() {
  const [nodes, setNodes] = useState<any[]>([]);
  const [metrics, setMetrics] = useState<Record<string, any[]>>({});
  const [alerts, setAlerts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const supabase = createSupabaseBrowserClient();

  const load = useCallback(async () => {
    const { data: n } = await supabase.from('nodes').select('*, sites(name)').in('status', ['active', 'offline']).order('name');
    setNodes(n ?? []);

    // Fetch metrics for each node (last hour)
    const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000).toISOString();
    const metricsMap: Record<string, any[]> = {};
    for (const node of n ?? []) {
      const { data: m } = await supabase
        .from('node_metrics')
        .select('cpu_pct, recorded_at')
        .eq('node_id', node.id)
        .gte('recorded_at', oneHourAgo)
        .order('recorded_at');
      metricsMap[node.id] = (m ?? []).map((r: any) => ({ cpu: r.cpu_pct ?? 0 }));
    }
    setMetrics(metricsMap);

    // Alerts
    const { data: a } = await supabase
      .from('node_events')
      .select('*, nodes(name)')
      .in('severity', ['warning', 'critical'])
      .order('created_at', { ascending: false })
      .limit(50);
    setAlerts(a ?? []);
    setLoading(false);
  }, []);

  useEffect(() => { load(); const i = setInterval(load, 30000); return () => clearInterval(i); }, [load]);

  const onlineNodes = nodes.filter((n) => n.status === 'active').length;
  const offlineNodes = nodes.filter((n) => n.status === 'offline').length;
  const totalSessions = nodes.reduce((s, n) => s + ((n.metadata as any)?.enrolled_devices ?? 0), 0);
  const totalStorage = nodes.reduce((s, n) => s + (n.storage_used_gb ?? 0), 0);
  const nodesWithWarnings = new Set(alerts.map((a) => a.node_id)).size;

  if (loading) return <div className="text-gray-400 py-20 text-center">Loading monitoring data...</div>;

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-gray-100">Fleet Monitoring</h1>

      {/* Stats row */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Card><CardHeader className="pb-2"><CardTitle className="text-sm text-gray-400">Nodes Online</CardTitle></CardHeader><CardContent><span className="text-2xl font-bold text-emerald-400">{onlineNodes}</span><span className="text-gray-500 text-sm"> / {nodes.length}</span>{offlineNodes > 0 && <span className="text-red-400 text-sm ml-2">({offlineNodes} offline)</span>}</CardContent></Card>
        <Card><CardHeader className="pb-2"><CardTitle className="text-sm text-gray-400">Active Sessions</CardTitle></CardHeader><CardContent><span className="text-2xl font-bold">{totalSessions}</span></CardContent></Card>
        <Card><CardHeader className="pb-2"><CardTitle className="text-sm text-gray-400">Total Storage Used</CardTitle></CardHeader><CardContent><span className="text-2xl font-bold">{totalStorage.toFixed(1)} GB</span></CardContent></Card>
        <Card><CardHeader className="pb-2"><CardTitle className="text-sm text-gray-400">Nodes with Warnings</CardTitle></CardHeader><CardContent><span className="text-2xl font-bold text-yellow-400">{nodesWithWarnings}</span></CardContent></Card>
      </div>

      {/* Node grid */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {nodes.map((node) => {
          const storagePct = node.storage_total_gb > 0 ? (node.storage_used_gb / node.storage_total_gb) * 100 : 0;
          const statusColor = node.status === 'active' ? 'bg-emerald-400' : 'bg-red-400';
          const cpuData = metrics[node.id] ?? [];

          return (
            <Link key={node.id} href={`/dashboard/global/nodes/${node.id}`}>
              <Card className="hover:border-brand-primary transition-colors cursor-pointer">
                <CardContent className="pt-4 space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <div className={`h-2.5 w-2.5 rounded-full ${statusColor}`} />
                      <span className="font-medium text-sm">{node.name}</span>
                    </div>
                    <span className="text-xs text-gray-500">{(node as any).sites?.name}</span>
                  </div>
                  {/* CPU sparkline */}
                  {cpuData.length > 0 && (
                    <div className="h-8">
                      <ResponsiveContainer width="100%" height="100%">
                        <LineChart data={cpuData}>
                          <Line type="monotone" dataKey="cpu" stroke="#6366f1" strokeWidth={1.5} dot={false} />
                          <Tooltip content={({ payload }) => payload?.[0] ? <div className="bg-brand-surface border border-gray-700 rounded px-2 py-1 text-xs">CPU: {(payload[0].value as number).toFixed(0)}%</div> : null} />
                        </LineChart>
                      </ResponsiveContainer>
                    </div>
                  )}
                  {/* Storage bar */}
                  <div className="flex items-center gap-2">
                    <HardDrive className="h-3 w-3 text-gray-500" />
                    <div className="h-1.5 flex-1 rounded-full bg-gray-700">
                      <div className="h-1.5 rounded-full bg-brand-primary" style={{ width: `${Math.min(storagePct, 100)}%` }} />
                    </div>
                    <span className="text-xs text-gray-500">{storagePct.toFixed(0)}%</span>
                  </div>
                  <div className="text-xs text-gray-500">
                    Last seen: {node.last_seen_at ? relativeTime(node.last_seen_at) : 'never'}
                  </div>
                </CardContent>
              </Card>
            </Link>
          );
        })}
      </div>

      {/* Alerts feed */}
      <Card>
        <CardHeader><CardTitle>Recent Alerts</CardTitle></CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader><TableRow><TableHead className="w-10"></TableHead><TableHead>Node</TableHead><TableHead>Event</TableHead><TableHead>Message</TableHead><TableHead>Time</TableHead></TableRow></TableHeader>
            <TableBody>
              {alerts.length === 0 && <TableRow><TableCell colSpan={5} className="text-center text-gray-500">No alerts</TableCell></TableRow>}
              {alerts.map((a) => (
                <TableRow key={a.id}>
                  <TableCell>{severityIcon(a.severity)}</TableCell>
                  <TableCell><Link href={`/dashboard/global/nodes/${a.node_id}`} className="text-brand-primary hover:underline text-sm">{(a as any).nodes?.name ?? '—'}</Link></TableCell>
                  <TableCell className="font-mono text-xs">{a.event_type}</TableCell>
                  <TableCell className="text-sm max-w-xs truncate">{a.message ?? '—'}</TableCell>
                  <TableCell className="text-xs whitespace-nowrap">{relativeTime(a.created_at)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
