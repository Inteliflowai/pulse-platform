import { notFound } from 'next/navigation';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { AlertTriangle, AlertCircle, Info, Zap } from 'lucide-react';
import { DecommissionButton } from './decommission-button';

function severityIcon(severity: string) {
  switch (severity) {
    case 'critical': return <AlertCircle className="h-4 w-4 text-red-400" />;
    case 'error': return <AlertTriangle className="h-4 w-4 text-red-400" />;
    case 'warning': return <AlertTriangle className="h-4 w-4 text-yellow-400" />;
    default: return <Info className="h-4 w-4 text-blue-400" />;
  }
}

function syncStatusBadge(status: string) {
  const map: Record<string, 'success' | 'warning' | 'destructive' | 'secondary'> = {
    completed: 'success',
    in_progress: 'warning',
    failed: 'destructive',
    pending: 'secondary',
    cancelled: 'secondary',
  };
  return <Badge variant={map[status] ?? 'secondary'}>{status}</Badge>;
}

export default async function NodeDetailPage({ params }: { params: Promise<{ nodeId: string }> }) {
  const { nodeId } = await params;
  const supabase = await createSupabaseServerClient();

  const { data: node } = await supabase
    .from('nodes')
    .select('*')
    .eq('id', nodeId)
    .single();

  if (!node) notFound();

  const [syncJobsRes, eventsRes] = await Promise.all([
    supabase
      .from('sync_jobs')
      .select('*, packages(name)')
      .eq('node_id', nodeId)
      .order('created_at', { ascending: false })
      .limit(10),
    supabase
      .from('node_events')
      .select('*')
      .eq('node_id', nodeId)
      .order('created_at', { ascending: false })
      .limit(20),
  ]);

  const syncJobs = syncJobsRes.data ?? [];
  const events = eventsRes.data ?? [];

  const storagePct =
    node.storage_total_gb && node.storage_total_gb > 0
      ? ((node.storage_used_gb ?? 0) / node.storage_total_gb * 100)
      : 0;

  const statusVariant = node.status === 'active' ? 'success' : node.status === 'offline' ? 'destructive' : 'secondary';

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-100">{node.name}</h1>
        <Badge variant={statusVariant} className="text-sm">{node.status}</Badge>
      </div>

      {/* Node metadata */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-gray-400">Hostname</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="font-mono text-gray-200">{node.hostname ?? '—'}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-gray-400">IP Address</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="font-mono text-gray-200">{node.ip_address ?? '—'}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-gray-400">Version</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="font-mono text-gray-200">{node.version ?? '—'}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-gray-400">Registered</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-gray-200">
              {node.registered_at ? new Date(node.registered_at).toLocaleString() : '—'}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Storage bar */}
      <Card>
        <CardHeader>
          <CardTitle>Storage</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            <div className="flex justify-between text-sm">
              <span className="text-gray-400">{(node.storage_used_gb ?? 0).toFixed(1)} GB used</span>
              <span className="text-gray-400">{(node.storage_total_gb ?? 0).toFixed(1)} GB total</span>
            </div>
            <div className="h-3 w-full rounded-full bg-gray-700">
              <div
                className="h-3 rounded-full bg-brand-primary transition-all"
                style={{ width: `${Math.min(storagePct, 100)}%` }}
              />
            </div>
            <p className="text-right text-xs text-gray-500">{storagePct.toFixed(0)}% used</p>
          </div>
        </CardContent>
      </Card>

      {/* Last heartbeat */}
      <Card>
        <CardHeader className="flex flex-row items-center gap-2">
          <Zap className="h-4 w-4 text-gray-400" />
          <CardTitle>Last Heartbeat</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-gray-200">
            {node.last_seen_at ? new Date(node.last_seen_at).toLocaleString() : 'No heartbeat received'}
          </p>
        </CardContent>
      </Card>

      {/* Sync job history */}
      <Card>
        <CardHeader>
          <CardTitle>Sync Job History</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Package</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Progress</TableHead>
                <TableHead>Started</TableHead>
                <TableHead>Completed</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {syncJobs.length === 0 && (
                <TableRow>
                  <TableCell colSpan={5} className="text-center text-gray-500">No sync jobs</TableCell>
                </TableRow>
              )}
              {syncJobs.map((job: any) => (
                <TableRow key={job.id}>
                  <TableCell>{job.packages?.name ?? '—'}</TableCell>
                  <TableCell>{syncStatusBadge(job.status)}</TableCell>
                  <TableCell>{job.progress_pct}%</TableCell>
                  <TableCell className="text-xs">{job.started_at ? new Date(job.started_at).toLocaleString() : '—'}</TableCell>
                  <TableCell className="text-xs">{job.completed_at ? new Date(job.completed_at).toLocaleString() : '—'}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Recent node events */}
      <Card>
        <CardHeader>
          <CardTitle>Recent Events</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-10"></TableHead>
                <TableHead>Event</TableHead>
                <TableHead>Message</TableHead>
                <TableHead>Time</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {events.length === 0 && (
                <TableRow>
                  <TableCell colSpan={4} className="text-center text-gray-500">No events</TableCell>
                </TableRow>
              )}
              {events.map((event: any) => (
                <TableRow key={event.id}>
                  <TableCell>{severityIcon(event.severity)}</TableCell>
                  <TableCell className="font-mono text-xs">{event.event_type}</TableCell>
                  <TableCell className="text-sm">{event.message ?? '—'}</TableCell>
                  <TableCell className="text-xs">{new Date(event.created_at).toLocaleString()}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Decommission */}
      {node.status !== 'decommissioned' && (
        <DecommissionButton nodeId={node.id} nodeName={node.name} />
      )}
    </div>
  );
}
