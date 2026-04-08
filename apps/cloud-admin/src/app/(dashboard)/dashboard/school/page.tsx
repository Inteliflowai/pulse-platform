import Link from 'next/link';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Server, Package, Monitor, RefreshCw } from 'lucide-react';

export default async function SchoolDashboardPage() {
  const supabase = await createSupabaseServerClient();
  const { data: { user: authUser } } = await supabase.auth.getUser();

  const { data: profile } = await supabase
    .from('users')
    .select('tenant_id, site_id')
    .eq('id', authUser!.id)
    .single();

  const tenantId = profile?.tenant_id;
  const siteId = profile?.site_id;

  // Fetch site info
  let siteName = 'Your School';
  if (siteId) {
    const { data: site } = await supabase.from('sites').select('name').eq('id', siteId).single();
    if (site) siteName = site.name;
  }

  // Fetch stats scoped to tenant
  const [nodesRes, packagesRes, devicesRes, lastSyncRes] = await Promise.all([
    supabase.from('nodes').select('id, status').eq('tenant_id', tenantId!),
    supabase.from('packages').select('id', { count: 'exact', head: true }).eq('tenant_id', tenantId!).eq('status', 'published'),
    supabase.from('devices').select('id', { count: 'exact', head: true }).eq('tenant_id', tenantId!).eq('status', 'enrolled'),
    supabase.from('sync_jobs').select('completed_at').eq('status', 'completed').order('completed_at', { ascending: false }).limit(1),
  ]);

  const nodes = nodesRes.data ?? [];
  const onlineNodes = nodes.filter((n) => n.status === 'active').length;
  const offlineNodes = nodes.filter((n) => n.status === 'offline').length;
  const totalPackages = packagesRes.count ?? 0;
  const totalDevices = devicesRes.count ?? 0;
  const lastSync = lastSyncRes.data?.[0]?.completed_at;

  return (
    <div className="space-y-6">
      {/* Welcome card */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-2xl">Welcome to {siteName}</CardTitle>
              <CardDescription className="mt-1">School dashboard overview</CardDescription>
            </div>
            <Badge variant={onlineNodes > 0 ? 'success' : 'destructive'}>
              {onlineNodes > 0 ? 'Node Online' : 'Node Offline'}
            </Badge>
          </div>
        </CardHeader>
      </Card>

      {/* Stats cards */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-gray-400">Node Health</CardTitle>
            <Server className="h-4 w-4 text-gray-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-gray-100">{onlineNodes} / {nodes.length}</div>
            <p className="text-xs text-gray-500 mt-1">
              {onlineNodes} online, {offlineNodes} offline
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-gray-400">Packages Available</CardTitle>
            <Package className="h-4 w-4 text-gray-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-gray-100">{totalPackages}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-gray-400">Devices Enrolled</CardTitle>
            <Monitor className="h-4 w-4 text-gray-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-gray-100">{totalDevices}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-gray-400">Last Sync</CardTitle>
            <RefreshCw className="h-4 w-4 text-gray-500" />
          </CardHeader>
          <CardContent>
            <div className="text-lg font-bold text-gray-100">
              {lastSync ? new Date(lastSync).toLocaleString() : 'Never'}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Quick actions */}
      <Card>
        <CardHeader>
          <CardTitle>Quick Actions</CardTitle>
        </CardHeader>
        <CardContent className="flex gap-3">
          <Button asChild>
            <Link href="/dashboard/content">Publish Content</Link>
          </Button>
          <Button variant="outline" asChild>
            <Link href="/dashboard/devices">Enroll Device</Link>
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
