'use client';

import { useState, useEffect, useCallback } from 'react';
import { createSupabaseBrowserClient } from '@/lib/supabase/browser';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { LineChart, Line, BarChart, Bar, AreaChart, Area, XAxis, YAxis, ResponsiveContainer, Tooltip, CartesianGrid } from 'recharts';

export default function AnalyticsPage() {
  const [sessionsData, setSessionsData] = useState<any[]>([]);
  const [syncData, setSyncData] = useState<any[]>([]);
  const [quizData, setQuizData] = useState<any[]>([]);
  const [contentData, setContentData] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [range, setRange] = useState(7); // days
  const supabase = createSupabaseBrowserClient();

  const load = useCallback(async () => {
    const since = new Date(Date.now() - range * 86400000).toISOString();

    // Sessions per day
    const { data: sessions } = await supabase
      .from('playback_sessions')
      .select('started_at')
      .gte('started_at', since);

    const sessionsByDay: Record<string, number> = {};
    for (let i = 0; i < range; i++) {
      const d = new Date(Date.now() - (range - 1 - i) * 86400000).toISOString().slice(0, 10);
      sessionsByDay[d] = 0;
    }
    for (const s of sessions ?? []) {
      const d = s.started_at?.slice(0, 10);
      if (d && sessionsByDay[d] !== undefined) sessionsByDay[d]++;
    }
    setSessionsData(Object.entries(sessionsByDay).map(([date, count]) => ({ date: date.slice(5), count })));

    // Sync jobs per day
    const { data: syncs } = await supabase
      .from('sync_jobs')
      .select('created_at, status')
      .gte('created_at', since);

    const syncByDay: Record<string, { completed: number; failed: number }> = {};
    for (let i = 0; i < range; i++) {
      const d = new Date(Date.now() - (range - 1 - i) * 86400000).toISOString().slice(0, 10);
      syncByDay[d] = { completed: 0, failed: 0 };
    }
    for (const s of syncs ?? []) {
      const d = s.created_at?.slice(0, 10);
      if (d && syncByDay[d]) {
        if (s.status === 'completed') syncByDay[d].completed++;
        else if (s.status === 'failed') syncByDay[d].failed++;
      }
    }
    setSyncData(Object.entries(syncByDay).map(([date, v]) => ({ date: date.slice(5), ...v })));

    // Quiz scores over time
    const { data: quizzes } = await supabase
      .from('quiz_attempts')
      .select('completed_at, percentage, passed')
      .eq('status', 'completed')
      .gte('completed_at', since)
      .order('completed_at');

    const quizByDay: Record<string, { total: number; sum: number; passed: number }> = {};
    for (let i = 0; i < range; i++) {
      const d = new Date(Date.now() - (range - 1 - i) * 86400000).toISOString().slice(0, 10);
      quizByDay[d] = { total: 0, sum: 0, passed: 0 };
    }
    for (const q of quizzes ?? []) {
      const d = q.completed_at?.slice(0, 10);
      if (d && quizByDay[d]) {
        quizByDay[d].total++;
        quizByDay[d].sum += q.percentage ?? 0;
        if (q.passed) quizByDay[d].passed++;
      }
    }
    setQuizData(Object.entries(quizByDay).map(([date, v]) => ({
      date: date.slice(5),
      avg_score: v.total > 0 ? Math.round(v.sum / v.total) : 0,
      pass_rate: v.total > 0 ? Math.round(v.passed / v.total * 100) : 0,
      attempts: v.total,
    })));

    // Content growth
    const { data: assets } = await supabase
      .from('assets')
      .select('created_at')
      .gte('created_at', since);

    const assetsByDay: Record<string, number> = {};
    let cumulative = 0;
    for (let i = 0; i < range; i++) {
      const d = new Date(Date.now() - (range - 1 - i) * 86400000).toISOString().slice(0, 10);
      assetsByDay[d] = 0;
    }
    for (const a of assets ?? []) {
      const d = a.created_at?.slice(0, 10);
      if (d && assetsByDay[d] !== undefined) assetsByDay[d]++;
    }
    const contentArr: any[] = [];
    for (const [date, count] of Object.entries(assetsByDay)) {
      cumulative += count;
      contentArr.push({ date: date.slice(5), new_assets: count, total: cumulative });
    }
    setContentData(contentArr);

    setLoading(false);
  }, [range]);

  useEffect(() => { load(); }, [load]);

  const chartStyle = { background: '#1e2130', border: '1px solid #374151', borderRadius: 8, fontSize: 12 };

  if (loading) return <div className="text-gray-400 py-20 text-center">Loading analytics...</div>;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-100">Analytics</h1>
        <div className="flex gap-2">
          {[7, 14, 30].map((d) => (
            <button key={d} onClick={() => setRange(d)}
              className={`px-3 py-1 rounded-md text-xs font-medium ${range === d ? 'bg-brand-primary text-white' : 'bg-brand-surface text-gray-400 hover:text-gray-200'}`}>
              {d}d
            </button>
          ))}
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader><CardTitle>Sessions per Day</CardTitle></CardHeader>
          <CardContent>
            <div className="h-52">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={sessionsData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
                  <XAxis dataKey="date" tick={{ fill: '#9ca3af', fontSize: 11 }} />
                  <YAxis tick={{ fill: '#9ca3af', fontSize: 11 }} allowDecimals={false} />
                  <Tooltip contentStyle={chartStyle} />
                  <Area type="monotone" dataKey="count" stroke="#6366f1" fill="rgba(99,102,241,0.2)" name="Sessions" />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle>Sync Jobs</CardTitle></CardHeader>
          <CardContent>
            <div className="h-52">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={syncData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
                  <XAxis dataKey="date" tick={{ fill: '#9ca3af', fontSize: 11 }} />
                  <YAxis tick={{ fill: '#9ca3af', fontSize: 11 }} allowDecimals={false} />
                  <Tooltip contentStyle={chartStyle} />
                  <Bar dataKey="completed" fill="#10b981" name="Completed" radius={[2, 2, 0, 0]} />
                  <Bar dataKey="failed" fill="#ef4444" name="Failed" radius={[2, 2, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle>Quiz Performance</CardTitle></CardHeader>
          <CardContent>
            <div className="h-52">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={quizData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
                  <XAxis dataKey="date" tick={{ fill: '#9ca3af', fontSize: 11 }} />
                  <YAxis tick={{ fill: '#9ca3af', fontSize: 11 }} domain={[0, 100]} />
                  <Tooltip contentStyle={chartStyle} />
                  <Line type="monotone" dataKey="avg_score" stroke="#6366f1" name="Avg Score %" strokeWidth={2} dot={false} />
                  <Line type="monotone" dataKey="pass_rate" stroke="#10b981" name="Pass Rate %" strokeWidth={2} dot={false} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle>Content Growth</CardTitle></CardHeader>
          <CardContent>
            <div className="h-52">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={contentData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
                  <XAxis dataKey="date" tick={{ fill: '#9ca3af', fontSize: 11 }} />
                  <YAxis tick={{ fill: '#9ca3af', fontSize: 11 }} allowDecimals={false} />
                  <Tooltip contentStyle={chartStyle} />
                  <Area type="monotone" dataKey="total" stroke="#f59e0b" fill="rgba(245,158,11,0.2)" name="Total Assets" />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
