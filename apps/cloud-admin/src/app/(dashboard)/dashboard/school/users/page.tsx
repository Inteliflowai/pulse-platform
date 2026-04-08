'use client';

import { useState, useEffect, useCallback } from 'react';
import { createSupabaseBrowserClient } from '@/lib/supabase/browser';
import { DEFAULT_ROLES } from '@pulse/shared';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter, DialogDescription } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { UserPlus } from 'lucide-react';

export default function UsersPage() {
  const [users, setUsers] = useState<any[]>([]);
  const [sites, setSites] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [inviteOpen, setInviteOpen] = useState(false);
  const [tenantId, setTenantId] = useState('');
  const [form, setForm] = useState({ email: '', role: 'teacher', site_id: '' });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const supabase = createSupabaseBrowserClient();

  const load = useCallback(async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    const { data: profile } = await supabase.from('users').select('tenant_id').eq('id', user.id).single();
    if (!profile) return;
    setTenantId(profile.tenant_id);

    const { data: u } = await supabase.from('users').select('*, sites(name)').eq('tenant_id', profile.tenant_id).order('created_at', { ascending: false });
    setUsers(u ?? []);

    const { data: s } = await supabase.from('sites').select('id, name').eq('tenant_id', profile.tenant_id);
    setSites(s ?? []);

    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  async function handleInvite() {
    setSaving(true);
    setError('');

    // Invite via Supabase Auth
    const { data: authData, error: authErr } = await supabase.auth.admin.createUser({
      email: form.email,
      email_confirm: false,
    });

    // If we can't use admin (anon key), try inviteUserByEmail
    if (authErr) {
      // Use the API route instead
      const res = await fetch('/api/users/invite', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...form, tenant_id: tenantId }),
      });
      if (!res.ok) {
        const data = await res.json();
        setError(data.error ?? 'Failed to invite user');
        setSaving(false);
        return;
      }
    } else if (authData?.user) {
      // Insert users row
      await supabase.from('users').insert({
        id: authData.user.id,
        tenant_id: tenantId,
        site_id: form.site_id || null,
        email: form.email,
        role: form.role,
      });
    }

    setInviteOpen(false);
    setForm({ email: '', role: 'teacher', site_id: '' });
    setSaving(false);
    load();
  }

  async function toggleUserStatus(userId: string, currentStatus: string) {
    const newStatus = currentStatus === 'active' ? 'inactive' : 'active';
    await supabase.from('users').update({ status: newStatus }).eq('id', userId);
    load();
  }

  async function updateRole(userId: string, role: string) {
    await supabase.from('users').update({ role }).eq('id', userId);
    load();
  }

  const roleOptions = Object.entries(DEFAULT_ROLES).filter(([k]) => k !== 'super_admin');

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-100">Users</h1>
        <Dialog open={inviteOpen} onOpenChange={setInviteOpen}>
          <DialogTrigger asChild>
            <Button><UserPlus className="mr-2 h-4 w-4" /> Invite User</Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Invite User</DialogTitle>
              <DialogDescription>Send an invitation email to a new user.</DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              <div className="space-y-2">
                <Label>Email</Label>
                <Input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} placeholder="user@school.edu" />
              </div>
              <div className="space-y-2">
                <Label>Role</Label>
                <Select value={form.role} onValueChange={(v) => setForm({ ...form, role: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {roleOptions.map(([k, v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Site</Label>
                <Select value={form.site_id} onValueChange={(v) => setForm({ ...form, site_id: v })}>
                  <SelectTrigger><SelectValue placeholder="Select site" /></SelectTrigger>
                  <SelectContent>
                    {sites.map((s) => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              {error && <div className="text-sm text-red-400">{error}</div>}
            </div>
            <DialogFooter>
              <Button onClick={handleInvite} disabled={saving || !form.email}>{saving ? 'Inviting...' : 'Send Invite'}</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Email</TableHead>
                <TableHead>Role</TableHead>
                <TableHead>Site</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="w-28">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading && <TableRow><TableCell colSpan={6} className="text-center text-gray-500">Loading...</TableCell></TableRow>}
              {!loading && users.length === 0 && <TableRow><TableCell colSpan={6} className="text-center text-gray-500">No users</TableCell></TableRow>}
              {users.map((u) => (
                <TableRow key={u.id}>
                  <TableCell className="font-medium">{u.full_name ?? '—'}</TableCell>
                  <TableCell className="text-sm">{u.email}</TableCell>
                  <TableCell>
                    <select
                      value={u.role}
                      onChange={(e) => updateRole(u.id, e.target.value)}
                      className="rounded border border-gray-600 bg-brand-bg px-2 py-0.5 text-xs text-gray-200"
                    >
                      {Object.entries(DEFAULT_ROLES).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                    </select>
                  </TableCell>
                  <TableCell className="text-sm">{(u as any).sites?.name ?? '—'}</TableCell>
                  <TableCell><Badge variant={u.status === 'active' ? 'success' : 'secondary'}>{u.status}</Badge></TableCell>
                  <TableCell>
                    <Button variant="ghost" size="sm" onClick={() => toggleUserStatus(u.id, u.status)}>
                      {u.status === 'active' ? 'Deactivate' : 'Activate'}
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
