'use client';

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Plus, Building2, Users, Server, ChevronRight, Search, AlertTriangle } from 'lucide-react';
import { Spinner } from '@/components/ui/spinner';

interface Customer {
  id: string;
  name: string;
  slug: string;
  status: string;
  created_at: string;
  sites: number;
  nodes: number;
  nodes_online: number;
  users: number;
  licenses: string[];
  expiring_soon: { product: string; days: number }[];
  expired: string[];
}

const PRODUCT_COLORS: Record<string, string> = {
  pulse: 'bg-brand-primary/20 text-brand-primary-light',
  spark: 'bg-yellow-500/20 text-yellow-300',
  core: 'bg-blue-500/20 text-blue-300',
  lift: 'bg-purple-500/20 text-purple-300',
};

export default function CustomersPage() {
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('');
  const [creating, setCreating] = useState(false);
  const [createForm, setCreateForm] = useState({ name: '', slug: '', initial_admin_email: '' });
  const [createError, setCreateError] = useState<string | null>(null);
  const [createOpen, setCreateOpen] = useState(false);

  const load = useCallback(async () => {
    const res = await fetch('/api/global/customers');
    if (!res.ok) { setLoading(false); return; }
    const data = await res.json();
    setCustomers(data.customers ?? []);
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  async function createCustomer() {
    setCreating(true);
    setCreateError(null);
    try {
      const res = await fetch('/api/global/customers', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: createForm.name,
          slug: createForm.slug || undefined,
          initial_admin_email: createForm.initial_admin_email || undefined,
        }),
      });
      const data = await res.json();
      if (!res.ok) { setCreateError(data.error ?? 'Failed'); return; }
      setCreateOpen(false);
      setCreateForm({ name: '', slug: '', initial_admin_email: '' });
      await load();
    } finally {
      setCreating(false);
    }
  }

  const filtered = filter
    ? customers.filter((c) => c.name.toLowerCase().includes(filter.toLowerCase()) || c.slug.toLowerCase().includes(filter.toLowerCase()))
    : customers;

  const totals = {
    customers: customers.length,
    nodes: customers.reduce((s, c) => s + c.nodes, 0),
    online: customers.reduce((s, c) => s + c.nodes_online, 0),
    users: customers.reduce((s, c) => s + c.users, 0),
  };

  return (
    <div className="mx-auto max-w-7xl space-y-4 p-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-gray-100">Customers</h1>
          <p className="mt-1 text-sm text-gray-400">
            Inteliflow customer directory. {totals.customers} {totals.customers === 1 ? 'tenant' : 'tenants'} · {totals.online}/{totals.nodes} nodes online · {totals.users} users.
          </p>
        </div>
        <Dialog open={createOpen} onOpenChange={setCreateOpen}>
          <DialogTrigger asChild>
            <Button><Plus className="mr-1 h-4 w-4" />New Customer</Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader><DialogTitle>Onboard New Customer</DialogTitle></DialogHeader>
            <div className="space-y-3 pt-2">
              <div>
                <Label className="text-xs">Organization name</Label>
                <Input value={createForm.name} onChange={(e) => setCreateForm((f) => ({ ...f, name: e.target.value }))} placeholder="Greenfield Academy" />
              </div>
              <div>
                <Label className="text-xs">Slug (optional — auto-generated)</Label>
                <Input value={createForm.slug} onChange={(e) => setCreateForm((f) => ({ ...f, slug: e.target.value }))} placeholder="greenfield-academy" />
              </div>
              <div>
                <Label className="text-xs">Initial tenant admin email (optional)</Label>
                <Input value={createForm.initial_admin_email} onChange={(e) => setCreateForm((f) => ({ ...f, initial_admin_email: e.target.value }))} placeholder="it@greenfield.edu" />
                <p className="mt-1 text-xs text-gray-500">A magic-link invite will be sent. They'll be created as <code>tenant_admin</code>.</p>
              </div>
              {createError && <p className="text-xs text-red-400">{createError}</p>}
              <div className="flex justify-end gap-2 pt-2">
                <Button variant="outline" onClick={() => setCreateOpen(false)}>Cancel</Button>
                <Button onClick={createCustomer} disabled={creating || !createForm.name.trim()}>
                  {creating ? 'Creating…' : 'Create Customer'}
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      <Card>
        <CardHeader className="flex flex-row items-center gap-2 space-y-0 py-3">
          <Search className="h-4 w-4 text-gray-500" />
          <Input
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
            placeholder="Filter by name or slug…"
            className="max-w-sm"
          />
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex items-center gap-2 text-sm text-gray-500"><Spinner className="h-4 w-4" /> Loading customers…</div>
          ) : filtered.length === 0 ? (
            <p className="text-sm text-gray-500">No customers{filter ? ' match the filter' : ' yet'}.</p>
          ) : (
            <div className="space-y-2">
              {filtered.map((c) => (
                <Link
                  key={c.id}
                  href={`/dashboard/global/customers/${c.id}`}
                  className="block rounded-md border border-gray-800 bg-brand-bg px-4 py-3 transition hover:border-brand-primary/50 hover:bg-brand-bg/70"
                >
                  <div className="flex items-center gap-4">
                    <div className="rounded-md bg-brand-primary/10 p-2 text-brand-primary-light">
                      <Building2 className="h-5 w-5" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-gray-200">{c.name}</p>
                      <p className="text-xs text-gray-500">
                        <code className="font-mono">{c.slug}</code> · created {new Date(c.created_at).toLocaleDateString()}
                      </p>
                    </div>
                    <div className="hidden items-center gap-4 text-xs text-gray-400 md:flex">
                      <span className="inline-flex items-center gap-1"><Building2 className="h-3 w-3" />{c.sites} sites</span>
                      <span className="inline-flex items-center gap-1"><Server className="h-3 w-3" />{c.nodes_online}/{c.nodes} online</span>
                      <span className="inline-flex items-center gap-1"><Users className="h-3 w-3" />{c.users} users</span>
                    </div>
                    <div className="flex items-center gap-1">
                      {c.expired.length > 0 && (
                        <Badge className="bg-red-500/20 text-[10px] text-red-300">
                          <AlertTriangle className="mr-0.5 inline h-3 w-3" />
                          {c.expired.length} expired
                        </Badge>
                      )}
                      {c.expiring_soon.length > 0 && (
                        <Badge
                          className="bg-yellow-500/20 text-[10px] text-yellow-300"
                          title={c.expiring_soon.map((e) => `${e.product}: ${e.days}d`).join(', ')}
                        >
                          {Math.min(...c.expiring_soon.map((e) => e.days))}d
                        </Badge>
                      )}
                      {c.licenses.length === 0 && c.expired.length === 0 ? (
                        <Badge variant="secondary" className="text-[10px]">no licenses</Badge>
                      ) : (
                        c.licenses.map((p) => (
                          <Badge key={p} className={`text-[10px] uppercase ${PRODUCT_COLORS[p] ?? 'bg-gray-500/20 text-gray-300'}`}>
                            {p}
                          </Badge>
                        ))
                      )}
                    </div>
                    <ChevronRight className="h-4 w-4 text-gray-600" />
                  </div>
                </Link>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
