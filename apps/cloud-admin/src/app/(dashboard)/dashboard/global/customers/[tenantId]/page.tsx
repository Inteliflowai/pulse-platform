'use client';

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { ArrowLeft, Building2, Server, Users, ShieldCheck, Clock, Plus, Activity } from 'lucide-react';
import { PageSpinner } from '@/components/ui/spinner';

const PRODUCTS = ['pulse', 'spark', 'core', 'lift'] as const;
const PLANS = ['trial', 'starter', 'professional', 'enterprise'] as const;
const STATUSES = ['active', 'suspended', 'trial'] as const;

const PRODUCT_COLORS: Record<string, string> = {
  pulse: 'bg-brand-primary/20 text-brand-primary-light',
  spark: 'bg-yellow-500/20 text-yellow-300',
  core: 'bg-blue-500/20 text-blue-300',
  lift: 'bg-purple-500/20 text-purple-300',
};

function licenseBadgeTone(status: string, expiresAt: string | null): string {
  if (status === 'suspended') return 'bg-red-500/20 text-red-300';
  if (expiresAt && new Date(expiresAt).getTime() < Date.now()) return 'bg-gray-500/20 text-gray-400';
  if (status === 'trial') return 'bg-yellow-500/20 text-yellow-300';
  return 'bg-emerald-500/20 text-emerald-300';
}

export default function CustomerDetailPage() {
  const params = useParams();
  const tenantId = params?.tenantId as string;

  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [provisionOpen, setProvisionOpen] = useState(false);
  const [provisionForm, setProvisionForm] = useState({
    product: 'spark' as typeof PRODUCTS[number],
    plan: 'starter' as typeof PLANS[number],
    seats: 0,
    expires_at: '',
    status: 'active' as typeof STATUSES[number],
    notes: '',
  });
  const [provisioning, setProvisioning] = useState(false);
  const [provisionError, setProvisionError] = useState<string | null>(null);
  const [pingResult, setPingResult] = useState<any>(null);
  const [pinging, setPinging] = useState(false);
  const [importResult, setImportResult] = useState<any>(null);
  const [importing, setImporting] = useState(false);

  const load = useCallback(async () => {
    const res = await fetch(`/api/global/customers/${tenantId}`);
    if (!res.ok) { setLoading(false); return; }
    setData(await res.json());
    setLoading(false);
  }, [tenantId]);

  useEffect(() => { load(); }, [load]);

  async function provision() {
    setProvisioning(true);
    setProvisionError(null);
    try {
      const res = await fetch('/api/licenses', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          tenant_id: tenantId,
          product: provisionForm.product,
          plan: provisionForm.plan,
          seats: provisionForm.seats,
          expires_at: provisionForm.expires_at || null,
          status: provisionForm.status,
          notes: provisionForm.notes || null,
        }),
      });
      const body = await res.json();
      if (!res.ok) { setProvisionError(body.error ?? 'Failed'); return; }
      setProvisionOpen(false);
      setProvisionForm({ product: 'spark', plan: 'starter', seats: 0, expires_at: '', status: 'active', notes: '' });
      await load();
    } finally {
      setProvisioning(false);
    }
  }

  async function pingCore() {
    setPinging(true);
    setPingResult(null);
    try {
      const res = await fetch('/api/integrations/core/ping', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tenant_id: tenantId }),
      });
      setPingResult(await res.json());
    } catch (err: any) {
      setPingResult({ ok: false, reason: 'client_error', error: err.message });
    } finally {
      setPinging(false);
    }
  }

  async function importClasses() {
    setImporting(true);
    setImportResult(null);
    try {
      const res = await fetch('/api/class-groups/import-from-core', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tenant_id: tenantId }),
      });
      const body = await res.json();
      setImportResult({ ok: res.ok, status: res.status, ...body });
    } catch (err: any) {
      setImportResult({ ok: false, error: err.message });
    } finally {
      setImporting(false);
    }
  }

  async function suspend(licenseId: string) {
    if (!confirm('Suspend this license? The customer will lose access immediately.')) return;
    const res = await fetch(`/api/licenses/${licenseId}`, { method: 'DELETE' });
    if (res.ok) await load();
  }

  if (loading) return <PageSpinner label="Loading customer" />;
  if (!data) return (
    <div className="p-6 flex flex-col items-start gap-3">
      <p className="text-red-400">Customer not found.</p>
      <Button variant="outline" size="sm" onClick={load}>Retry</Button>
    </div>
  );

  const { tenant, sites, nodes, users, licenses, recent_activity, integrations } = data;
  const nodesOnline = nodes.filter((n: any) => n.status === 'active').length;
  const coreLicense = licenses.find((l: any) => l.product === 'core');
  const coreCred = integrations?.core ?? null;

  return (
    <div className="mx-auto max-w-7xl space-y-4 p-6">
      <Link href="/dashboard/global/customers" className="inline-flex items-center gap-1 text-xs text-gray-400 hover:text-gray-200">
        <ArrowLeft className="h-3 w-3" /> All customers
      </Link>

      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-gray-100">{tenant.name}</h1>
          <p className="mt-1 text-sm text-gray-400">
            <code className="font-mono text-xs">{tenant.slug}</code> · created {new Date(tenant.created_at).toLocaleDateString()}
          </p>
        </div>
        <Badge className={tenant.status === 'active' ? 'bg-emerald-500/20 text-emerald-300' : 'bg-yellow-500/20 text-yellow-300'}>
          {tenant.status}
        </Badge>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
        <StatCard icon={<Building2 className="h-5 w-5" />} label="Sites" value={sites.length} />
        <StatCard icon={<Server className="h-5 w-5" />} label="Nodes" value={`${nodesOnline}/${nodes.length}`} sub={nodesOnline === nodes.length ? 'all online' : `${nodes.length - nodesOnline} offline`} />
        <StatCard icon={<Users className="h-5 w-5" />} label="Users" value={users.length} />
        <StatCard icon={<ShieldCheck className="h-5 w-5" />} label="Licenses" value={licenses.length} sub={licenses.filter((l: any) => l.status === 'active').length + ' active'} />
      </div>

      {/* Licenses */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0">
          <CardTitle className="text-base">Product Licenses</CardTitle>
          <Dialog open={provisionOpen} onOpenChange={setProvisionOpen}>
            <DialogTrigger asChild>
              <Button size="sm"><Plus className="mr-1 h-3 w-3" />Provision License</Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader><DialogTitle>Provision License for {tenant.name}</DialogTitle></DialogHeader>
              <div className="space-y-3 pt-2">
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <Label className="text-xs">Product</Label>
                    <Select value={provisionForm.product} onValueChange={(v) => setProvisionForm((f) => ({ ...f, product: v as any }))}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {PRODUCTS.map((p) => <SelectItem key={p} value={p}>{p.toUpperCase()}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label className="text-xs">Plan</Label>
                    <Select value={provisionForm.plan} onValueChange={(v) => setProvisionForm((f) => ({ ...f, plan: v as any }))}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {PLANS.map((p) => <SelectItem key={p} value={p}>{p}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label className="text-xs">Seats (0 = unlimited)</Label>
                    <Input type="number" value={provisionForm.seats} onChange={(e) => setProvisionForm((f) => ({ ...f, seats: parseInt(e.target.value) || 0 }))} />
                  </div>
                  <div>
                    <Label className="text-xs">Status</Label>
                    <Select value={provisionForm.status} onValueChange={(v) => setProvisionForm((f) => ({ ...f, status: v as any }))}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {STATUSES.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <div>
                  <Label className="text-xs">Expires at (blank = perpetual)</Label>
                  <Input type="date" value={provisionForm.expires_at} onChange={(e) => setProvisionForm((f) => ({ ...f, expires_at: e.target.value }))} />
                </div>
                <div>
                  <Label className="text-xs">Notes (internal)</Label>
                  <Input value={provisionForm.notes} onChange={(e) => setProvisionForm((f) => ({ ...f, notes: e.target.value }))} placeholder="PO #12345, signed 2026-04-20" />
                </div>
                <p className="text-[11px] text-gray-500">Re-provisioning an existing product updates the current row (renewal).</p>
                {provisionError && <p className="text-xs text-red-400">{provisionError}</p>}
                <div className="flex justify-end gap-2 pt-2">
                  <Button variant="outline" onClick={() => setProvisionOpen(false)}>Cancel</Button>
                  <Button onClick={provision} disabled={provisioning}>
                    {provisioning ? 'Provisioning…' : 'Provision'}
                  </Button>
                </div>
              </div>
            </DialogContent>
          </Dialog>
        </CardHeader>
        <CardContent>
          {licenses.length === 0 ? (
            <p className="text-sm text-gray-500">No licenses provisioned yet.</p>
          ) : (
            <div className="space-y-2">
              {licenses.map((l: any) => (
                <div key={l.id} className="flex items-center gap-3 rounded-md border border-gray-800 bg-brand-bg px-3 py-2 text-xs">
                  <Badge className={`uppercase ${PRODUCT_COLORS[l.product] ?? 'bg-gray-500/20 text-gray-300'}`}>{l.product}</Badge>
                  <span className="text-gray-300">{l.plan}</span>
                  <span className="text-gray-500">{l.seats === 0 ? 'unlimited seats' : `${l.seats} seats`}</span>
                  <Badge className={licenseBadgeTone(l.status, l.expires_at)}>{l.status}</Badge>
                  <span className="flex-1 text-gray-500">
                    {l.expires_at ? `expires ${new Date(l.expires_at).toLocaleDateString()}` : 'perpetual'}
                  </span>
                  {l.status !== 'suspended' && (
                    <Button size="sm" variant="outline" onClick={() => suspend(l.id)}>Suspend</Button>
                  )}
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* CORE Integration */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0">
          <CardTitle className="flex items-center gap-2 text-base">
            <Activity className="h-4 w-4" /> CORE Integration
          </CardTitle>
          {coreCred && coreLicense && (
            <div className="flex gap-2">
              <Button size="sm" variant="outline" onClick={pingCore} disabled={pinging}>
                {pinging ? 'Testing…' : 'Test connection'}
              </Button>
              <Button size="sm" variant="outline" onClick={importClasses} disabled={importing}>
                {importing ? 'Importing…' : 'Import classes'}
              </Button>
            </div>
          )}
        </CardHeader>
        <CardContent className="space-y-3 text-xs">
          <div className="flex flex-wrap items-center gap-3">
            <span className="text-gray-500">License:</span>
            {coreLicense ? (
              <Badge className={licenseBadgeTone(coreLicense.status, coreLicense.expires_at)}>
                {coreLicense.status}{coreLicense.expires_at ? ` · expires ${new Date(coreLicense.expires_at).toLocaleDateString()}` : ' · perpetual'}
              </Badge>
            ) : (
              <Badge className="bg-gray-500/20 text-gray-400">not licensed</Badge>
            )}

            <span className="ml-4 text-gray-500">Credential:</span>
            {coreCred ? (
              <>
                <Badge className={coreCred.status === 'active' ? 'bg-emerald-500/20 text-emerald-300' : 'bg-yellow-500/20 text-yellow-300'}>
                  {coreCred.status}
                </Badge>
                <code className="font-mono text-gray-400">{coreCred.key_preview}</code>
                <span className="text-gray-500">issued {new Date(coreCred.created_at).toLocaleDateString()}</span>
              </>
            ) : (
              <Badge className="bg-gray-500/20 text-gray-400">no Bearer key provisioned</Badge>
            )}
          </div>

          {coreCred?.api_url && (
            <div className="text-gray-500">
              CORE API URL: <code className="font-mono text-gray-300">{coreCred.api_url}</code>
            </div>
          )}

          {pingResult && (
            <div className={`rounded-md border px-3 py-2 ${pingResult.ok ? 'border-emerald-500/30 bg-emerald-500/5 text-emerald-300' : 'border-red-500/30 bg-red-500/5 text-red-300'}`}>
              {pingResult.ok ? (
                <>✓ CORE responded in {pingResult.latency_ms}ms (HTTP {pingResult.http_status})</>
              ) : (
                <>✗ {pingResult.reason}{pingResult.http_status ? ` · HTTP ${pingResult.http_status}` : ''}{pingResult.error ? ` · ${pingResult.error}` : ''}</>
              )}
            </div>
          )}

          {importResult && (
            <div className={`rounded-md border px-3 py-2 ${importResult.ok ? 'border-emerald-500/30 bg-emerald-500/5 text-emerald-300' : 'border-red-500/30 bg-red-500/5 text-red-300'}`}>
              {importResult.ok ? (
                <>✓ Imported {importResult.imported} new class(es), updated {importResult.updated} existing — {importResult.total} total returned by CORE</>
              ) : (
                <>✗ {importResult.error ?? 'Import failed'}{importResult.http_status ? ` · CORE HTTP ${importResult.http_status}` : ''}</>
              )}
            </div>
          )}

          {!coreLicense && !coreCred && (
            <p className="text-gray-500">No CORE integration set up for this tenant. Provision a CORE license above to auto-generate a Bearer key.</p>
          )}
        </CardContent>
      </Card>

      {/* Sites and Nodes */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader><CardTitle className="text-base">Sites</CardTitle></CardHeader>
          <CardContent>
            {sites.length === 0 ? (
              <p className="text-sm text-gray-500">No sites yet.</p>
            ) : (
              <div className="space-y-1">
                {sites.map((s: any) => (
                  <div key={s.id} className="flex items-center justify-between border-b border-gray-800 py-1.5 text-xs last:border-0">
                    <span className="text-gray-200">{s.name}</span>
                    <code className="font-mono text-gray-500">{s.slug}</code>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle className="text-base">Nodes</CardTitle></CardHeader>
          <CardContent>
            {nodes.length === 0 ? (
              <p className="text-sm text-gray-500">No nodes yet.</p>
            ) : (
              <div className="space-y-1">
                {nodes.map((n: any) => (
                  <div key={n.id} className="flex items-center gap-2 border-b border-gray-800 py-1.5 text-xs last:border-0">
                    <Badge className={n.status === 'active' ? 'bg-emerald-500/20 text-emerald-300' : 'bg-red-500/20 text-red-300'}>
                      {n.status}
                    </Badge>
                    <span className="flex-1 text-gray-200">{n.name}</span>
                    <code className="font-mono text-gray-500">{n.version ?? '?'}</code>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Recent activity */}
      <Card>
        <CardHeader><CardTitle className="text-base">Recent Activity</CardTitle></CardHeader>
        <CardContent>
          {recent_activity.length === 0 ? (
            <p className="text-sm text-gray-500">No audit entries yet.</p>
          ) : (
            <div className="space-y-1">
              {recent_activity.map((a: any) => (
                <div key={a.id} className="flex items-center gap-2 border-b border-gray-800 py-1 text-xs last:border-0">
                  <Clock className="h-3 w-3 text-gray-500" />
                  <code className="font-mono text-[11px] text-gray-400">{a.event_type}</code>
                  <span className="flex-1 truncate text-gray-300">{a.description}</span>
                  <span className="tabular-nums text-gray-600">{new Date(a.created_at).toLocaleString()}</span>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function StatCard({ icon, label, value, sub }: { icon: React.ReactNode; label: string; value: string | number; sub?: string }) {
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
        {sub && <p className="mt-2 text-xs text-gray-500">{sub}</p>}
      </CardContent>
    </Card>
  );
}
