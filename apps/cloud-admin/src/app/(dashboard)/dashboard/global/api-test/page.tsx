'use client';

import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Play, CheckCircle2, XCircle, AlertCircle, Clock } from 'lucide-react';

/**
 * Super-admin API health checker. Fires a curated set of safe GET endpoints
 * in parallel and reports status and latency. Useful for post-deploy smoke
 * tests and investigating "is something broken?" reports from schools.
 *
 * Unlike /dashboard/settings/api-test (the full interactive tester), this
 * page is read-only and batch-runs the canary set in one click.
 */

interface Probe {
  label: string;
  url: string;
  // A probe counts as healthy if the response status is in this set.
  // Most should return 200, but some (eg. /api/reports without ?type=) are
  // expected to 400 — we want to confirm the handler ran, not that it succeeded.
  expectedStatuses: number[];
  group: string;
  critical: boolean;
}

const PROBES: Probe[] = [
  { label: 'Platform health', url: '/api/health', expectedStatuses: [200], group: 'Core', critical: true },
  { label: 'Curriculum index', url: '/api/curriculum', expectedStatuses: [200], group: 'Content', critical: true },
  { label: 'Sequence list', url: '/api/curriculum/sequences', expectedStatuses: [200], group: 'Content', critical: true },
  { label: 'Classroom list', url: '/api/classrooms', expectedStatuses: [200], group: 'School', critical: true },
  { label: 'Schedule list', url: '/api/schedules', expectedStatuses: [200], group: 'School', critical: true },
  { label: 'Notifications', url: '/api/notifications', expectedStatuses: [200], group: 'Core', critical: false },
  { label: 'Alert subscriptions', url: '/api/alerts/subscriptions', expectedStatuses: [200], group: 'Ops', critical: false },
  { label: 'Reports (missing type → 400)', url: '/api/reports', expectedStatuses: [400], group: 'Ops', critical: false },
  { label: 'Quick-lesson (missing body → 400)', url: '/api/quick-lesson', expectedStatuses: [400, 405], group: 'School', critical: false },
  { label: 'Devices validate-token (missing → 400)', url: '/api/devices/validate-token', expectedStatuses: [400], group: 'Devices', critical: false },
  { label: 'Cron (unauthorized → 401)', url: '/api/cron/check-offline-nodes', expectedStatuses: [401], group: 'Security', critical: true },
  { label: 'Node-jobs (unauthorized → 401)', url: '/api/sync/node-jobs/any-id', expectedStatuses: [401], group: 'Security', critical: true },
  { label: 'Node config (unauthorized → 401)', url: '/api/nodes/any-id/config', expectedStatuses: [401], group: 'Security', critical: true },
  { label: 'Progress (unauthorized → 401)', url: '/api/progress', expectedStatuses: [401], group: 'Security', critical: true },
];

interface ProbeResult {
  status: number | null;
  durationMs: number;
  error?: string;
  passed: boolean;
}

export default function GlobalApiTestPage() {
  const [results, setResults] = useState<Map<string, ProbeResult>>(new Map());
  const [running, setRunning] = useState(false);

  async function runAll() {
    setRunning(true);
    setResults(new Map());

    // Fire in parallel, record results as they come in.
    await Promise.all(PROBES.map(async (p) => {
      const start = performance.now();
      try {
        const isPost = p.url.includes('quick-lesson') || p.url.includes('progress');
        const res = await fetch(p.url, {
          method: isPost ? 'POST' : 'GET',
          credentials: 'include',
          headers: isPost ? { 'Content-Type': 'application/json' } : undefined,
          body: isPost ? '{}' : undefined,
        });
        const durationMs = Math.round(performance.now() - start);
        const passed = p.expectedStatuses.includes(res.status);
        setResults((prev) => new Map(prev).set(p.url, { status: res.status, durationMs, passed }));
      } catch (err: any) {
        const durationMs = Math.round(performance.now() - start);
        setResults((prev) => new Map(prev).set(p.url, { status: null, durationMs, passed: false, error: err?.message ?? 'Network error' }));
      }
    }));

    setRunning(false);
  }

  const byGroup: Record<string, Probe[]> = {};
  for (const p of PROBES) {
    if (!byGroup[p.group]) byGroup[p.group] = [];
    byGroup[p.group].push(p);
  }

  const total = PROBES.length;
  const answered = results.size;
  const passing = Array.from(results.values()).filter((r) => r.passed).length;
  const criticalFailing = PROBES.filter((p) => p.critical && results.has(p.url) && !results.get(p.url)!.passed).length;

  return (
    <div className="mx-auto max-w-5xl space-y-4 p-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-gray-100">Platform API Health</h1>
          <p className="mt-1 text-sm text-gray-400">
            Fires {total} canary probes in parallel. Useful post-deploy or when a school reports "nothing loads."
            For per-endpoint testing with a body editor, use{' '}
            <a href="/dashboard/settings/api-test" className="text-brand-primary-light underline">Settings → API Test</a>.
          </p>
        </div>
        <Button onClick={runAll} disabled={running}>
          <Play className="mr-1 h-4 w-4" />
          {running ? 'Running…' : 'Run All'}
        </Button>
      </div>

      {/* Summary */}
      {answered > 0 && (
        <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
          <SummaryCard label="Probes Completed" value={`${answered} / ${total}`} />
          <SummaryCard label="Passing" value={passing} tone={passing === total ? 'ok' : 'warn'} />
          <SummaryCard label="Failing" value={answered - passing} tone={answered - passing > 0 ? 'err' : 'ok'} />
          <SummaryCard label="Critical Failures" value={criticalFailing} tone={criticalFailing > 0 ? 'err' : 'ok'} />
        </div>
      )}

      {Object.keys(byGroup).sort().map((group) => (
        <Card key={group}>
          <CardHeader><CardTitle className="text-base">{group}</CardTitle></CardHeader>
          <CardContent>
            <div className="space-y-1">
              {byGroup[group].map((p) => {
                const r = results.get(p.url);
                return (
                  <div key={p.url} className="flex items-center gap-3 rounded-md border border-gray-800 bg-brand-bg px-3 py-2 text-xs">
                    {r ? (
                      r.passed ? (
                        <CheckCircle2 className="h-4 w-4 flex-shrink-0 text-emerald-400" />
                      ) : (
                        <XCircle className="h-4 w-4 flex-shrink-0 text-red-400" />
                      )
                    ) : running ? (
                      <Clock className="h-4 w-4 flex-shrink-0 animate-pulse text-gray-500" />
                    ) : (
                      <AlertCircle className="h-4 w-4 flex-shrink-0 text-gray-600" />
                    )}

                    <div className="flex-1 min-w-0">
                      <p className="text-gray-200">{p.label}</p>
                      <code className="font-mono text-[11px] text-gray-500">{p.url}</code>
                    </div>

                    {p.critical && <Badge variant="secondary" className="text-[10px]">critical</Badge>}

                    <span className="text-gray-500">
                      expects {p.expectedStatuses.join('/')}
                    </span>

                    {r && (
                      <>
                        {r.error ? (
                          <Badge className="bg-red-500/20 text-red-300">ERR</Badge>
                        ) : (
                          <Badge
                            className={
                              r.passed
                                ? 'bg-emerald-500/20 text-emerald-300'
                                : 'bg-red-500/20 text-red-300'
                            }
                          >
                            {r.status}
                          </Badge>
                        )}
                        <span className="tabular-nums text-gray-600">{r.durationMs}ms</span>
                      </>
                    )}
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

function SummaryCard({ label, value, tone }: { label: string; value: string | number; tone?: 'ok' | 'warn' | 'err' }) {
  const color = tone === 'err' ? 'text-red-400' : tone === 'warn' ? 'text-yellow-400' : 'text-gray-100';
  return (
    <Card>
      <CardContent className="p-3">
        <p className="text-xs uppercase tracking-wide text-gray-500">{label}</p>
        <p className={`mt-1 text-xl font-semibold ${color}`}>{value}</p>
      </CardContent>
    </Card>
  );
}
