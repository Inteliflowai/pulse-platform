'use client';

import { useState, useEffect } from 'react';
import { createSupabaseBrowserClient } from '@/lib/supabase/browser';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { QRCodeSVG } from 'qrcode.react';
import { Copy, Check } from 'lucide-react';

interface Tenant {
  id: string;
  name: string;
}

interface Site {
  id: string;
  name: string;
  tenant_id: string;
}

interface ProvisionResult {
  nodeId: string;
  registrationToken: string;
  cloudApiUrl: string;
}

export default function NewNodePage() {
  const [tenants, setTenants] = useState<Tenant[]>([]);
  const [sites, setSites] = useState<Site[]>([]);
  const [tenantId, setTenantId] = useState('');
  const [siteId, setSiteId] = useState('');
  const [nodeName, setNodeName] = useState('');
  const [hostname, setHostname] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [result, setResult] = useState<ProvisionResult | null>(null);
  const [copied, setCopied] = useState('');

  const supabase = createSupabaseBrowserClient();

  useEffect(() => {
    supabase.from('tenants').select('id, name').order('name').then(({ data }) => {
      setTenants(data ?? []);
    });
  }, []);

  useEffect(() => {
    if (!tenantId) { setSites([]); return; }
    supabase.from('sites').select('id, name, tenant_id').eq('tenant_id', tenantId).order('name').then(({ data }) => {
      setSites(data ?? []);
    });
  }, [tenantId]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    setLoading(true);

    const registrationToken = crypto.randomUUID();

    const { data, error: insertError } = await supabase
      .from('nodes')
      .insert({
        tenant_id: tenantId,
        site_id: siteId,
        name: nodeName,
        hostname: hostname || null,
        status: 'pending',
        registration_token: registrationToken,
      })
      .select('id')
      .single();

    if (insertError) {
      setError(insertError.message);
      setLoading(false);
      return;
    }

    setResult({
      nodeId: data.id,
      registrationToken,
      cloudApiUrl: window.location.origin,
    });
    setLoading(false);
  }

  function copyToClipboard(text: string, key: string) {
    navigator.clipboard.writeText(text);
    setCopied(key);
    setTimeout(() => setCopied(''), 2000);
  }

  if (result) {
    return (
      <div className="space-y-6 max-w-2xl">
        <h1 className="text-2xl font-bold text-gray-100">Node Setup Sheet</h1>

        <Card>
          <CardHeader>
            <CardTitle>Registration Details</CardTitle>
            <CardDescription>Print or copy these details for the on-site technician.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {[
              { label: 'Node ID', value: result.nodeId },
              { label: 'Registration Token', value: result.registrationToken },
              { label: 'Cloud API URL', value: result.cloudApiUrl },
            ].map((item) => (
              <div key={item.label} className="flex items-center justify-between rounded-lg border border-gray-700 bg-brand-bg p-3">
                <div>
                  <p className="text-xs text-gray-400">{item.label}</p>
                  <p className="font-mono text-sm text-gray-200 break-all">{item.value}</p>
                </div>
                <button onClick={() => copyToClipboard(item.value, item.label)} className="ml-2 text-gray-400 hover:text-gray-200">
                  {copied === item.label ? <Check className="h-4 w-4 text-emerald-400" /> : <Copy className="h-4 w-4" />}
                </button>
              </div>
            ))}

            <div className="flex justify-center py-4">
              <div className="rounded-lg bg-white p-4">
                <QRCodeSVG value={result.registrationToken} size={180} />
              </div>
            </div>

            <div className="rounded-lg border border-gray-700 bg-brand-bg p-4">
              <p className="text-xs font-medium text-gray-400 mb-2">Docker Setup Instructions</p>
              <pre className="text-xs text-gray-300 whitespace-pre-wrap">{`# 1. Clone the Pulse repo on the appliance
# 2. cd docker
# 3. Copy .env.example to .env and set:
#    NODE_ID=${result.nodeId}
#    NODE_REGISTRATION_TOKEN=${result.registrationToken}
#    CLOUD_API_URL=${result.cloudApiUrl}
# 4. Run: docker compose up -d
# 5. The node-agent will auto-register on first boot.`}</pre>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="max-w-lg">
      <h1 className="text-2xl font-bold text-gray-100 mb-6">Provision New Node</h1>

      <Card>
        <CardContent className="pt-6">
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label>Tenant</Label>
              <Select value={tenantId} onValueChange={setTenantId}>
                <SelectTrigger><SelectValue placeholder="Select tenant" /></SelectTrigger>
                <SelectContent>
                  {tenants.map((t) => (
                    <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Site</Label>
              <Select value={siteId} onValueChange={setSiteId} disabled={!tenantId}>
                <SelectTrigger><SelectValue placeholder="Select site" /></SelectTrigger>
                <SelectContent>
                  {sites.map((s) => (
                    <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="nodeName">Node Name</Label>
              <Input id="nodeName" value={nodeName} onChange={(e) => setNodeName(e.target.value)} placeholder="e.g. Main Building Node" required />
            </div>

            <div className="space-y-2">
              <Label htmlFor="hostname">Hostname (optional)</Label>
              <Input id="hostname" value={hostname} onChange={(e) => setHostname(e.target.value)} placeholder="e.g. pulse-node-01" />
            </div>

            {error && (
              <div className="rounded-md bg-red-500/10 border border-red-500/30 px-3 py-2 text-sm text-red-400">{error}</div>
            )}

            <Button type="submit" className="w-full" disabled={loading || !tenantId || !siteId || !nodeName}>
              {loading ? 'Provisioning...' : 'Provision Node'}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
