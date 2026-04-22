'use client';

import { useState, useEffect, useMemo } from 'react';
import { createSupabaseBrowserClient } from '@/lib/supabase/browser';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Label } from '@/components/ui/label';
import { Play, Clock, ChevronRight } from 'lucide-react';
import { CATALOG, endpointsForRole, type Endpoint, type Role } from './endpoints';

interface HistoryEntry {
  id: string;
  method: string;
  path: string;
  status: number | null;
  durationMs: number;
  at: string;
  error?: string;
}

const METHOD_COLORS: Record<string, string> = {
  GET: 'bg-emerald-500/20 text-emerald-300',
  POST: 'bg-blue-500/20 text-blue-300',
  PATCH: 'bg-yellow-500/20 text-yellow-300',
  DELETE: 'bg-red-500/20 text-red-300',
};

export default function ApiTestPage() {
  const supabase = createSupabaseBrowserClient();
  const [role, setRole] = useState<Role | null>(null);
  const [selected, setSelected] = useState<Endpoint | null>(null);
  const [pathOverride, setPathOverride] = useState('');
  const [headerText, setHeaderText] = useState('{\n  "Content-Type": "application/json"\n}');
  const [bodyText, setBodyText] = useState('');
  const [response, setResponse] = useState<{ status: number; body: string; durationMs: number; headers: Record<string, string> } | null>(null);
  const [sendError, setSendError] = useState<string | null>(null);
  const [sending, setSending] = useState(false);
  const [history, setHistory] = useState<HistoryEntry[]>([]);
  const [filter, setFilter] = useState('');

  useEffect(() => {
    async function loadRole() {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      const { data: profile } = await supabase.from('users').select('role').eq('id', user.id).single();
      if (profile) setRole(profile.role as Role);
    }
    loadRole();
  }, [supabase]);

  const available = useMemo(() => {
    if (!role) return [];
    const list = endpointsForRole(role);
    if (!filter) return list;
    const q = filter.toLowerCase();
    return list.filter(
      (e) => e.path.toLowerCase().includes(q) || e.description.toLowerCase().includes(q) || e.group.toLowerCase().includes(q),
    );
  }, [role, filter]);

  const byGroup = useMemo(() => {
    const out: Record<string, Endpoint[]> = {};
    for (const e of available) {
      if (!out[e.group]) out[e.group] = [];
      out[e.group].push(e);
    }
    return out;
  }, [available]);

  function selectEndpoint(e: Endpoint) {
    setSelected(e);
    setPathOverride(e.path);
    setBodyText(e.sampleBody ? JSON.stringify(e.sampleBody, null, 2) : '');
    setResponse(null);
    setSendError(null);
  }

  async function send() {
    if (!selected) return;
    setSending(true);
    setSendError(null);
    setResponse(null);

    let headers: Record<string, string>;
    try {
      headers = headerText.trim() ? JSON.parse(headerText) : {};
    } catch {
      setSendError('Headers are not valid JSON');
      setSending(false);
      return;
    }

    let bodyPayload: string | undefined;
    if (selected.method !== 'GET' && selected.method !== 'DELETE' && bodyText.trim()) {
      try {
        JSON.parse(bodyText); // validate
        bodyPayload = bodyText;
      } catch {
        setSendError('Body is not valid JSON');
        setSending(false);
        return;
      }
    }

    const url = pathOverride.startsWith('http') ? pathOverride : pathOverride;
    const start = performance.now();
    try {
      const res = await fetch(url, {
        method: selected.method,
        headers,
        body: bodyPayload,
        credentials: 'include',
      });
      const durationMs = Math.round(performance.now() - start);
      const respHeaders: Record<string, string> = {};
      res.headers.forEach((v, k) => { respHeaders[k] = v; });
      const text = await res.text();
      let pretty = text;
      try {
        pretty = JSON.stringify(JSON.parse(text), null, 2);
      } catch {}
      setResponse({ status: res.status, body: pretty, durationMs, headers: respHeaders });
      addHistory({ id: crypto.randomUUID(), method: selected.method, path: url, status: res.status, durationMs, at: new Date().toISOString() });
    } catch (err: any) {
      const durationMs = Math.round(performance.now() - start);
      setSendError(err?.message ?? 'Request failed');
      addHistory({ id: crypto.randomUUID(), method: selected.method, path: url, status: null, durationMs, at: new Date().toISOString(), error: err?.message });
    } finally {
      setSending(false);
    }
  }

  function addHistory(entry: HistoryEntry) {
    setHistory((prev) => [entry, ...prev].slice(0, 20));
  }

  if (!role) {
    return <div className="p-6 text-gray-400">Loading…</div>;
  }

  return (
    <div className="mx-auto max-w-7xl space-y-4 p-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-gray-100">API Test</h1>
          <p className="mt-1 text-sm text-gray-400">
            Interactive tester. Endpoints below are filtered to what{' '}
            <Badge variant="secondary" className="mx-1 text-[10px]">{role.replace('_', ' ')}</Badge>
            can call. Your session cookie is sent automatically.
          </p>
        </div>
        <Badge variant="secondary" className="text-xs">
          {available.length} of {CATALOG.length} endpoints
        </Badge>
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-[320px_1fr]">
        {/* Endpoint catalog */}
        <Card className="lg:h-[calc(100vh-220px)] lg:overflow-auto">
          <CardHeader className="sticky top-0 z-10 bg-brand-surface">
            <Input
              placeholder="Filter endpoints…"
              value={filter}
              onChange={(e) => setFilter(e.target.value)}
              className="text-sm"
            />
          </CardHeader>
          <CardContent className="space-y-4 pt-0">
            {Object.keys(byGroup).sort().map((group) => (
              <div key={group}>
                <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-gray-500">{group}</p>
                <div className="space-y-1">
                  {byGroup[group].map((e) => {
                    const active = selected?.path === e.path && selected?.method === e.method;
                    return (
                      <button
                        key={`${e.method}-${e.path}`}
                        onClick={() => selectEndpoint(e)}
                        className={`w-full rounded-md px-2 py-1.5 text-left text-xs transition ${
                          active ? 'bg-brand-primary/20 text-brand-primary-light' : 'hover:bg-brand-bg text-gray-300'
                        }`}
                      >
                        <div className="flex items-center gap-1.5">
                          <span className={`rounded px-1.5 py-0.5 font-mono text-[10px] ${METHOD_COLORS[e.method]}`}>
                            {e.method}
                          </span>
                          <code className="truncate font-mono text-[11px]">{e.path.replace('/api', '')}</code>
                        </div>
                        <p className="mt-0.5 text-[11px] text-gray-500">{e.description}</p>
                      </button>
                    );
                  })}
                </div>
              </div>
            ))}
            {available.length === 0 && (
              <p className="px-1 text-sm text-gray-500">No endpoints match your filter.</p>
            )}
          </CardContent>
        </Card>

        {/* Request / response pane */}
        <div className="space-y-4">
          {!selected ? (
            <Card><CardContent className="p-6 text-sm text-gray-500">
              Select an endpoint from the left to begin.
            </CardContent></Card>
          ) : (
            <>
              <Card>
                <CardHeader>
                  <div className="flex items-center gap-2">
                    <span className={`rounded px-2 py-0.5 font-mono text-xs ${METHOD_COLORS[selected.method]}`}>
                      {selected.method}
                    </span>
                    <Input
                      value={pathOverride}
                      onChange={(e) => setPathOverride(e.target.value)}
                      className="flex-1 font-mono text-sm"
                      placeholder="/api/..."
                    />
                    <Button onClick={send} disabled={sending}>
                      <Play className="mr-1 h-4 w-4" />
                      {sending ? 'Sending…' : 'Send'}
                    </Button>
                  </div>
                  <p className="mt-1 text-xs text-gray-400">{selected.description}</p>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div>
                    <Label className="text-xs text-gray-400">Headers (JSON)</Label>
                    <textarea
                      value={headerText}
                      onChange={(e) => setHeaderText(e.target.value)}
                      className="mt-1 w-full rounded-md border border-gray-700 bg-brand-bg p-2 font-mono text-xs text-gray-200 focus:border-brand-primary focus:outline-none"
                      rows={3}
                    />
                  </div>
                  {selected.method !== 'GET' && selected.method !== 'DELETE' && (
                    <div>
                      <Label className="text-xs text-gray-400">Body (JSON)</Label>
                      <textarea
                        value={bodyText}
                        onChange={(e) => setBodyText(e.target.value)}
                        className="mt-1 w-full rounded-md border border-gray-700 bg-brand-bg p-2 font-mono text-xs text-gray-200 focus:border-brand-primary focus:outline-none"
                        rows={8}
                        placeholder="{}"
                      />
                    </div>
                  )}
                  {sendError && (
                    <p className="text-xs text-red-400">{sendError}</p>
                  )}
                </CardContent>
              </Card>

              {response && (
                <Card>
                  <CardHeader>
                    <div className="flex items-center gap-3">
                      <CardTitle className="text-base">Response</CardTitle>
                      <Badge
                        className={
                          response.status >= 200 && response.status < 300
                            ? 'bg-emerald-500/20 text-emerald-300'
                            : response.status >= 400
                              ? 'bg-red-500/20 text-red-300'
                              : 'bg-yellow-500/20 text-yellow-300'
                        }
                      >
                        {response.status}
                      </Badge>
                      <span className="text-xs text-gray-500">{response.durationMs} ms</span>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <pre className="max-h-96 overflow-auto rounded-md bg-brand-bg p-3 font-mono text-xs text-gray-200">
                      {response.body || '(empty)'}
                    </pre>
                  </CardContent>
                </Card>
              )}

              {history.length > 0 && (
                <Card>
                  <CardHeader><CardTitle className="text-base">History</CardTitle></CardHeader>
                  <CardContent className="space-y-1">
                    {history.map((h) => (
                      <div key={h.id} className="flex items-center gap-2 text-xs">
                        <Clock className="h-3 w-3 text-gray-500" />
                        <span className={`rounded px-1.5 py-0.5 font-mono text-[10px] ${METHOD_COLORS[h.method] ?? 'bg-gray-500/20'}`}>
                          {h.method}
                        </span>
                        <code className="flex-1 truncate font-mono text-[11px] text-gray-400">{h.path}</code>
                        {h.status !== null ? (
                          <Badge
                            className={
                              h.status >= 200 && h.status < 300
                                ? 'bg-emerald-500/10 text-emerald-300'
                                : 'bg-red-500/10 text-red-300'
                            }
                          >
                            {h.status}
                          </Badge>
                        ) : (
                          <Badge className="bg-red-500/10 text-red-300">ERR</Badge>
                        )}
                        <span className="tabular-nums text-gray-600">{h.durationMs}ms</span>
                      </div>
                    ))}
                  </CardContent>
                </Card>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
