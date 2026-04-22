'use client';

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ShieldCheck, ChevronRight } from 'lucide-react';

const PRODUCTS = ['all', 'pulse', 'spark', 'core', 'lift'] as const;
const STATUSES = ['all', 'active', 'trial', 'suspended', 'expired'] as const;

const PRODUCT_COLORS: Record<string, string> = {
  pulse: 'bg-brand-primary/20 text-brand-primary-light',
  spark: 'bg-yellow-500/20 text-yellow-300',
  core: 'bg-blue-500/20 text-blue-300',
  lift: 'bg-purple-500/20 text-purple-300',
};

function statusTone(status: string, expiresAt: string | null): string {
  if (status === 'suspended') return 'bg-red-500/20 text-red-300';
  if (expiresAt && new Date(expiresAt).getTime() < Date.now()) return 'bg-gray-500/20 text-gray-400';
  if (status === 'trial') return 'bg-yellow-500/20 text-yellow-300';
  return 'bg-emerald-500/20 text-emerald-300';
}

export default function LicensesPage() {
  const [licenses, setLicenses] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [productFilter, setProductFilter] = useState<typeof PRODUCTS[number]>('all');
  const [statusFilter, setStatusFilter] = useState<typeof STATUSES[number]>('all');

  const load = useCallback(async () => {
    const qs = new URLSearchParams();
    if (productFilter !== 'all') qs.set('product', productFilter);
    if (statusFilter !== 'all' && statusFilter !== 'expired') qs.set('status', statusFilter);
    const res = await fetch(`/api/licenses?${qs}`);
    if (!res.ok) { setLoading(false); return; }
    const data = await res.json();
    let rows = data.licenses ?? [];
    // Client-side expired filter (computed, not stored)
    if (statusFilter === 'expired') {
      rows = rows.filter((l: any) => l.expires_at && new Date(l.expires_at).getTime() < Date.now());
    }
    setLicenses(rows);
    setLoading(false);
  }, [productFilter, statusFilter]);

  useEffect(() => { load(); }, [load]);

  const counts = {
    total: licenses.length,
    active: licenses.filter((l) => l.status === 'active' && !(l.expires_at && new Date(l.expires_at).getTime() < Date.now())).length,
    expired: licenses.filter((l) => l.expires_at && new Date(l.expires_at).getTime() < Date.now()).length,
    suspended: licenses.filter((l) => l.status === 'suspended').length,
  };

  return (
    <div className="mx-auto max-w-7xl space-y-4 p-6">
      <div>
        <h1 className="text-2xl font-semibold text-gray-100">Licenses</h1>
        <p className="mt-1 text-sm text-gray-400">
          All product licenses across all customers. To provision a new one, open the customer's page and click "Provision License".
        </p>
      </div>

      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <SummaryCard label="Total" value={counts.total} />
        <SummaryCard label="Active" value={counts.active} tone="ok" />
        <SummaryCard label="Expired" value={counts.expired} tone={counts.expired > 0 ? 'warn' : undefined} />
        <SummaryCard label="Suspended" value={counts.suspended} tone={counts.suspended > 0 ? 'warn' : undefined} />
      </div>

      <Card>
        <CardHeader className="flex flex-row items-center gap-3 space-y-0 py-3">
          <div className="flex items-center gap-2 text-xs">
            <span className="text-gray-500">Product:</span>
            <Select value={productFilter} onValueChange={(v) => setProductFilter(v as any)}>
              <SelectTrigger className="h-8 w-32"><SelectValue /></SelectTrigger>
              <SelectContent>
                {PRODUCTS.map((p) => <SelectItem key={p} value={p}>{p === 'all' ? 'All' : p.toUpperCase()}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="flex items-center gap-2 text-xs">
            <span className="text-gray-500">Status:</span>
            <Select value={statusFilter} onValueChange={(v) => setStatusFilter(v as any)}>
              <SelectTrigger className="h-8 w-32"><SelectValue /></SelectTrigger>
              <SelectContent>
                {STATUSES.map((s) => <SelectItem key={s} value={s}>{s === 'all' ? 'All' : s}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
        </CardHeader>
        <CardContent>
          {loading ? (
            <p className="text-sm text-gray-500">Loading…</p>
          ) : licenses.length === 0 ? (
            <p className="text-sm text-gray-500">No licenses match the filter.</p>
          ) : (
            <div className="space-y-1">
              {licenses.map((l: any) => (
                <Link
                  key={l.id}
                  href={`/dashboard/global/customers/${l.tenant_id}`}
                  className="flex items-center gap-3 rounded-md border border-gray-800 bg-brand-bg px-3 py-2 text-xs transition hover:border-brand-primary/50"
                >
                  <ShieldCheck className="h-4 w-4 text-gray-500" />
                  <Badge className={`uppercase ${PRODUCT_COLORS[l.product] ?? 'bg-gray-500/20 text-gray-300'}`}>{l.product}</Badge>
                  <span className="text-gray-300">{l.plan}</span>
                  <span className="flex-1 text-gray-200">{l.tenants?.name ?? l.tenant_id}</span>
                  <Badge className={statusTone(l.status, l.expires_at)}>{l.status}</Badge>
                  <span className="w-32 tabular-nums text-right text-gray-500">
                    {l.expires_at ? `exp ${new Date(l.expires_at).toLocaleDateString()}` : 'perpetual'}
                  </span>
                  <ChevronRight className="h-4 w-4 text-gray-600" />
                </Link>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function SummaryCard({ label, value, tone }: { label: string; value: string | number; tone?: 'ok' | 'warn' }) {
  const color = tone === 'warn' ? 'text-yellow-400' : tone === 'ok' ? 'text-emerald-400' : 'text-gray-100';
  return (
    <Card>
      <CardContent className="p-3">
        <p className="text-xs uppercase tracking-wide text-gray-500">{label}</p>
        <p className={`mt-1 text-xl font-semibold ${color}`}>{value}</p>
      </CardContent>
    </Card>
  );
}
