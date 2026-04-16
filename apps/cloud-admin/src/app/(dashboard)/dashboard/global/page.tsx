import Link from 'next/link';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Building2, Server, RefreshCw, HardDrive } from 'lucide-react';

function statusBadge(status: string) {
  const variant = status === 'active' ? 'success' : status === 'offline' ? 'destructive' : 'secondary';
  return <Badge variant={variant}>{status}</Badge>;
}

export default async function GlobalOverviewPage() {
  const supabase = await createSupabaseServerClient();

  const [tenantsRes, nodesRes, syncJobsRes] = await Promise.all([
    supabase.from('tenants').select('id', { count: 'exact', head: true }),
    supabase.from('nodes').select('*'),
    supabase.from('sync_jobs').select('id', { count: 'exact', head: true }).eq('status', 'in_progress'),
  ]);

  const totalTenants = tenantsRes.count ?? 0;
  const nodes = nodesRes.data ?? [];
  const activeSyncJobs = syncJobsRes.count ?? 0;
  const onlineNodes = nodes.filter((n) => n.status === 'active').length;
  const offlineNodes = nodes.filter((n) => n.status === 'offline').length;
  const totalStorageUsed = nodes.reduce((sum, n) => sum + (n.storage_used_gb ?? 0), 0);

  const stats = [
    { label: 'Total Tenants', value: totalTenants, icon: Building2 },
    { label: 'Total Nodes', value: `${nodes.length} (${onlineNodes} online / ${offlineNodes} offline)`, icon: Server },
    { label: 'Active Sync Jobs', value: activeSyncJobs, icon: RefreshCw },
    { label: 'Storage Used', value: `${totalStorageUsed.toFixed(1)} GB`, icon: HardDrive },
  ];

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-gray-100">Global Overview</h1>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {stats.map((stat) => (
          <Card key={stat.label}>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-gray-400">{stat.label}</CardTitle>
              <stat.icon className="h-4 w-4 text-gray-500" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-gray-100">{stat.value}</div>
            </CardContent>
          </Card>
        ))}
      </div>

      <Card>
        <CardHeader>
          <CardTitle>All Nodes</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Node Name</TableHead>
                <TableHead>Site</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Version</TableHead>
                <TableHead>Last Seen</TableHead>
                <TableHead>Storage %</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {nodes.length === 0 && (
                <TableRow>
                  <TableCell colSpan={6} className="text-center text-gray-500">
                    No nodes registered yet
                  </TableCell>
                </TableRow>
              )}
              {nodes.map((node) => {
                const storagePct =
                  node.storage_total_gb && node.storage_total_gb > 0
                    ? ((node.storage_used_gb ?? 0) / node.storage_total_gb * 100).toFixed(0)
                    : '—';
                return (
                  <TableRow key={node.id}>
                    <TableCell>
                      <Link href={`/dashboard/global/nodes/${node.id}`} className="text-brand-primary-light hover:underline font-medium">
                        {node.name}
                      </Link>
                    </TableCell>
                    <TableCell>{node.site_id?.slice(0, 8) ?? '—'}</TableCell>
                    <TableCell>{statusBadge(node.status)}</TableCell>
                    <TableCell className="font-mono text-xs">{node.version ?? '—'}</TableCell>
                    <TableCell className="text-xs">
                      {node.last_seen_at ? new Date(node.last_seen_at).toLocaleString() : '—'}
                    </TableCell>
                    <TableCell>
                      {storagePct !== '—' ? (
                        <div className="flex items-center gap-2">
                          <div className="h-2 w-16 rounded-full bg-gray-700">
                            <div
                              className="h-2 rounded-full bg-brand-primary"
                              style={{ width: `${Math.min(Number(storagePct), 100)}%` }}
                            />
                          </div>
                          <span className="text-xs">{storagePct}%</span>
                        </div>
                      ) : '—'}
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
