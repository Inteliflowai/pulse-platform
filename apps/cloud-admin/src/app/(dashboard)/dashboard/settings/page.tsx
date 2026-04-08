'use client';

import { useState, useEffect } from 'react';
import { createSupabaseBrowserClient } from '@/lib/supabase/browser';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';

export default function SettingsPage() {
  const [nodes, setNodes] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const supabase = createSupabaseBrowserClient();

  useEffect(() => {
    async function load() {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      const { data: profile } = await supabase.from('users').select('tenant_id').eq('id', user.id).single();
      if (!profile) return;

      const { data } = await supabase.from('nodes').select('*').eq('tenant_id', profile.tenant_id);
      setNodes(data ?? []);
      setLoading(false);
    }
    load();
  }, []);

  async function reRegisterNode(nodeId: string) {
    const newToken = crypto.randomUUID();
    await supabase.from('nodes').update({
      registration_token: newToken,
      status: 'pending',
      registered_at: null,
    }).eq('id', nodeId);

    alert(`New registration token: ${newToken}\n\nUpdate the node's .env with this token and restart.`);
    window.location.reload();
  }

  if (loading) return <div className="text-gray-400 py-20 text-center">Loading...</div>;

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-gray-100">Settings</h1>

      {nodes.map((node) => (
        <Card key={node.id}>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle>{node.name}</CardTitle>
              <Badge variant={node.status === 'active' ? 'success' : 'secondary'}>{node.status}</Badge>
            </div>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-4 text-sm">
              <div><span className="text-gray-400 block">Node ID</span><span className="font-mono text-xs">{node.id}</span></div>
              <div><span className="text-gray-400 block">Hostname</span>{node.hostname ?? '—'}</div>
              <div><span className="text-gray-400 block">Version</span>{node.version ?? '—'}</div>
              <div><span className="text-gray-400 block">IP Address</span><span className="font-mono">{node.ip_address ?? '—'}</span></div>
              <div><span className="text-gray-400 block">Registered</span>{node.registered_at ? new Date(node.registered_at).toLocaleString() : '—'}</div>
              <div><span className="text-gray-400 block">Last Seen</span>{node.last_seen_at ? new Date(node.last_seen_at).toLocaleString() : '—'}</div>
            </div>
            <div className="mt-4">
              <Button variant="destructive" onClick={() => reRegisterNode(node.id)}>
                Re-register Node
              </Button>
            </div>
          </CardContent>
        </Card>
      ))}

      {nodes.length === 0 && (
        <Card>
          <CardContent className="py-10 text-center text-gray-500">No nodes configured for this tenant.</CardContent>
        </Card>
      )}
    </div>
  );
}
