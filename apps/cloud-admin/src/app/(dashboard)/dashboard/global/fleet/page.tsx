'use client';

import { useState, useEffect, useCallback } from 'react';
import { createSupabaseBrowserClient } from '@/lib/supabase/browser';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Building2, Server, Activity, Download, AlertTriangle, Users, HardDrive, TrendingUp } from 'lucide-react';

interface FleetStats {
  tenants: number;
  sites: number;
  nodes: { total: number; active: number; offline: number };
  devices: { total: number; enrolled: number };
  classrooms: number;
  syncJobs: { pending: number; in_progress: number; failed_24h: number };
  storageUsedGb: number;
  storageTotalGb: number;
  recentAlerts: Array<{ id: string; event_type: string; severity: string; message: string; created_at: string; node_id: string }>;
  releaseRollout: Array<{ version: string; node_count: number; is_latest: boolean }>;
  topTenants: Array<{ tenant_id: string; name: string; node_count: number; online: number; offline: number }>;
}

function pctBarColor(pct: number): string {
  if (pct > 90) return 'bg-red-500';
  if (pct > 75) return 'bg-yellow-500';
  return 'bg-emerald-500';
}

function relativeTime(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  if (diff < 60_000) return `${Math.floor(diff / 1000)}s ago`;
  if (diff < 3_600_000) return `${Math.floor(diff / 60_000)}m ago`;
  if (diff < 86_400_000) return `${Math.floor(diff / 3_600_000)}h ago`;
  return `${Math.floor(diff / 86_400_000)}d ago`;
}

export default function FleetDashboardPage() {
  const [stats, setStats] = useState<FleetStats | null>(null);
  const [loading, setLoading] = useState(true);
  const supabase = createSupabaseBrowserClient();

  const load = useCallback(async () => {
    const since24h = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();

    const [
      tenantsQ,
      sitesQ,
      nodesQ,
      devicesQ,
      classroomsQ,
      pendingQ,
      inProgressQ,
      failedQ,
      alertsQ,
      releasesQ,
    ] = await Promise.all([
      supabase.from('tenants').select('id, name', { count: 'exact' }),
      supabase.from('sites').select('id', { count: 'exact', head: true }),
      supabase.from('nodes').select('id, tenant_id, status, storage_used_gb, storage_total_gb, version'),
      supabase.from('devices').select('id, status', { count: 'exact' }),
      supabase.from('classrooms').select('id', { count: 'exact', head: true }),
      supabase.from('sync_jobs').select('id', { count: 'exact', head: true }).eq('status', 'pending'),
      supabase.from('sync_jobs').select('id', { count: 'exact', head: true }).eq('status', 'in_progress'),
      supabase.from('sync_jobs').select('id', { count: 'exact', head: true }).eq('status', 'failed').gte('updated_at', since24h),
      supabase.from('node_events').select('id, event_type, severity, message, created_at, node_id').in('severity', ['warning', 'error', 'critical']).order('created_at', { ascending: false }).limit(10),
      supabase.from('software_releases').select('version, status, released_at').eq('status', 'released').order('released_at', { ascending: false }).limit(5),
    ]);

    const nodes = nodesQ.data ?? [];
    const active = nodes.filter((n: any) => n.status === 'active').length;
    const offline = nodes.filter((n: any) => n.status === 'offline').length;

    const storageUsed = nodes.reduce((s: number, n: any) => s + (n.storage_used_gb ?? 0), 0);
    const storageTotal = nodes.reduce((s: number, n: any) => s + (n.storage_total_gb ?? 0), 0);

    // Version → count.
    const versionCount = new Map<string, number>();
    for (const n of nodes) {
      const v = n.version ?? 'unknown';
      versionCount.set(v, (versionCount.get(v) ?? 0) + 1);
    }
    const latestVersion = (releasesQ.data ?? [])[0]?.version;
    const releaseRollout = Array.from(versionCount.entries())
      .map(([version, node_count]) => ({ version, node_count, is_latest: version === latestVersion }))
      .sort((a, b) => b.node_count - a.node_count);

    // Top tenants by node count.
    const tenantMap = new Map<string, { id: string; name: string; total: number; online: number; offline: number }>();
    const tenantNames = new Map((tenantsQ.data ?? []).map((t: any) => [t.id, t.name]));
    for (const n of nodes) {
      const tid = n.tenant_id;
      if (!tenantMap.has(tid)) tenantMap.set(tid, { id: tid, name: tenantNames.get(tid) ?? 'Unknown', total: 0, online: 0, offline: 0 });
      const entry = tenantMap.get(tid)!;
      entry.total++;
      if (n.status === 'active') entry.online++;
      else if (n.status === 'offline') entry.offline++;
    }
    const topTenants = Array.from(tenantMap.values())
      .sort((a, b) => b.total - a.total)
      .slice(0, 5)
      .map((t) => ({ tenant_id: t.id, name: t.name, node_count: t.total, online: t.online, offline: t.offline }));

    const enrolled = (devicesQ.data ?? []).filter((d: any) => d.status === 'enrolled').length;

    setStats({
      tenants: tenantsQ.count ?? 0,
      sites: sitesQ.count ?? 0,
      nodes: { total: nodes.length, active, offline },
      devices: { total: devicesQ.count ?? 0, enrolled },
      classrooms: classroomsQ.count ?? 0,
      syncJobs: {
        pending: pendingQ.count ?? 0,
        in_progress: inProgressQ.count ?? 0,
        failed_24h: failedQ.count ?? 0,
      },
      storageUsedGb: storageUsed,
      storageTotalGb: storageTotal,
      recentAlerts: alertsQ.data ?? [],
      releaseRollout,
      topTenants,
    });
    setLoading(false);
  }, [supabase]);

  useEffect(() => {
    load();
    const interval = setInterval(load, 30_000); // refresh every 30s
    return () => clearInterval(interval);
  }, [load]);

  if (loading || !stats) {
    return <div className="p-6 text-gray-400">Loading fleet…</div>;
  }

  const nodesHealthPct = stats.nodes.total > 0 ? (stats.nodes.active / stats.nodes.total) * 100 : 100;
  const storagePct = stats.storageTotalGb > 0 ? (stats.storageUsedGb / stats.storageTotalGb) * 100 : 0;
  const latestRolloutPct = stats.nodes.total > 0
    ? ((stats.releaseRollout.find((r) => r.is_latest)?.node_count ?? 0) / stats.nodes.total) * 100
    : 0;

  return (
    <div className="mx-auto max-w-7xl space-y-4 p-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-gray-100">Fleet Dashboard</h1>
          <p className="mt-1 text-sm text-gray-400">Aggregate view across all tenants. Refreshes every 30 seconds.</p>
        </div>
        <Badge variant="secondary" className="text-xs">{stats.tenants} tenants</Badge>
      </div>

      {/* Top stat cards */}
      <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
        <StatCard icon={<Building2 className="h-5 w-5" />} label="Schools" value={stats.sites} sub={`${stats.tenants} tenants`} />
        <StatCard
          icon={<Server className="h-5 w-5" />}
          label="Nodes Online"
          value={`${stats.nodes.active} / ${stats.nodes.total}`}
          sub={stats.nodes.offline > 0 ? `${stats.nodes.offline} offline` : 'all healthy'}
          tone={stats.nodes.offline > 0 ? 'warn' : 'ok'}
        />
        <StatCard icon={<Users className="h-5 w-5" />} label="Classrooms" value={stats.classrooms} sub={`${stats.devices.enrolled} enrolled devices`} />
        <StatCard
          icon={<Activity className="h-5 w-5" />}
          label="Sync Jobs"
          value={stats.syncJobs.pending + stats.syncJobs.in_progress}
          sub={stats.syncJobs.failed_24h > 0 ? `${stats.syncJobs.failed_24h} failed in last 24h` : 'no recent failures'}
          tone={stats.syncJobs.failed_24h > 0 ? 'warn' : 'ok'}
        />
      </div>

      {/* Health bars */}
      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        <HealthBar label="Fleet Uptime" pct={nodesHealthPct} detail={`${stats.nodes.active} of ${stats.nodes.total} nodes active`} />
        <HealthBar label="Aggregate Storage" pct={storagePct} detail={`${stats.storageUsedGb.toFixed(0)} / ${stats.storageTotalGb.toFixed(0)} GB`} />
        <HealthBar label="Latest Release Rollout" pct={latestRolloutPct} detail={stats.releaseRollout.find((r) => r.is_latest)?.version ?? 'no published release'} />
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        {/* Top tenants */}
        <Card>
          <CardHeader><CardTitle className="text-base">Top Tenants by Node Count</CardTitle></CardHeader>
          <CardContent>
            {stats.topTenants.length === 0 ? (
              <p className="text-sm text-gray-500">No tenants yet.</p>
            ) : (
              <div className="space-y-2">
                {stats.topTenants.map((t) => (
                  <div key={t.tenant_id} className="flex items-center justify-between rounded-md border border-gray-800 bg-brand-bg px-3 py-2">
                    <div>
                      <p className="text-sm text-gray-200">{t.name}</p>
                      <p className="text-xs text-gray-500">{t.node_count} nodes · {t.online} online</p>
                    </div>
                    {t.offline > 0 ? (
                      <Badge className="bg-red-500/20 text-red-300">{t.offline} offline</Badge>
                    ) : (
                      <Badge className="bg-emerald-500/20 text-emerald-300">healthy</Badge>
                    )}
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Release rollout */}
        <Card>
          <CardHeader><CardTitle className="text-base">Version Rollout</CardTitle></CardHeader>
          <CardContent>
            {stats.releaseRollout.length === 0 ? (
              <p className="text-sm text-gray-500">No nodes reporting a version yet.</p>
            ) : (
              <div className="space-y-2">
                {stats.releaseRollout.map((r) => {
                  const pct = stats.nodes.total > 0 ? (r.node_count / stats.nodes.total) * 100 : 0;
                  return (
                    <div key={r.version}>
                      <div className="mb-1 flex items-center justify-between text-xs">
                        <div className="flex items-center gap-1.5">
                          <code className="font-mono text-gray-300">{r.version}</code>
                          {r.is_latest && <Badge className="bg-emerald-500/20 text-[10px] text-emerald-300">latest</Badge>}
                        </div>
                        <span className="tabular-nums text-gray-500">{r.node_count} nodes · {pct.toFixed(0)}%</span>
                      </div>
                      <div className="h-1.5 overflow-hidden rounded-full bg-brand-bg">
                        <div className={`h-full ${r.is_latest ? 'bg-emerald-500' : 'bg-gray-600'}`} style={{ width: `${pct}%` }} />
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Recent alerts */}
      <Card>
        <CardHeader><CardTitle className="text-base">Recent Platform Alerts</CardTitle></CardHeader>
        <CardContent>
          {stats.recentAlerts.length === 0 ? (
            <p className="text-sm text-gray-500">No warnings or errors in the last batch. Nice.</p>
          ) : (
            <div className="space-y-1">
              {stats.recentAlerts.map((a) => (
                <div key={a.id} className="flex items-center gap-2 border-b border-gray-800 py-1.5 text-xs last:border-0">
                  <AlertTriangle
                    className={
                      a.severity === 'critical' || a.severity === 'error'
                        ? 'h-3.5 w-3.5 text-red-400'
                        : 'h-3.5 w-3.5 text-yellow-400'
                    }
                  />
                  <code className="font-mono text-[11px] text-gray-400">{a.event_type}</code>
                  <span className="flex-1 truncate text-gray-300">{a.message}</span>
                  <span className="tabular-nums text-gray-600">{relativeTime(a.created_at)}</span>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

interface StatCardProps {
  icon: React.ReactNode;
  label: string;
  value: string | number;
  sub?: string;
  tone?: 'ok' | 'warn';
}

function StatCard({ icon, label, value, sub, tone }: StatCardProps) {
  return (
    <Card>
      <CardContent className="p-4">
        <div className="flex items-center gap-3">
          <div className="rounded-md bg-brand-primary/10 p-2 text-brand-primary-light">{icon}</div>
          <div>
            <p className="text-xs uppercase tracking-wide text-gray-500">{label}</p>
            <p className="mt-0.5 text-xl font-semibold text-gray-100">{value}</p>
          </div>
        </div>
        {sub && (
          <p className={`mt-2 text-xs ${tone === 'warn' ? 'text-yellow-400' : 'text-gray-500'}`}>{sub}</p>
        )}
      </CardContent>
    </Card>
  );
}

interface HealthBarProps {
  label: string;
  pct: number;
  detail: string;
}

function HealthBar({ label, pct, detail }: HealthBarProps) {
  return (
    <Card>
      <CardContent className="p-4">
        <div className="flex items-center justify-between">
          <p className="text-xs uppercase tracking-wide text-gray-500">{label}</p>
          <p className="text-sm font-semibold text-gray-200">{pct.toFixed(0)}%</p>
        </div>
        <div className="mt-2 h-2 overflow-hidden rounded-full bg-brand-bg">
          <div className={`h-full transition-all ${pctBarColor(pct)}`} style={{ width: `${Math.min(pct, 100)}%` }} />
        </div>
        <p className="mt-2 text-xs text-gray-500">{detail}</p>
      </CardContent>
    </Card>
  );
}
