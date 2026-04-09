'use client';

import { useState, useEffect, useCallback } from 'react';
import { createSupabaseBrowserClient } from '@/lib/supabase/browser';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { BarChart, Bar, XAxis, YAxis, ResponsiveContainer, Tooltip } from 'recharts';
import { CheckCircle, Clock, BookOpen } from 'lucide-react';

export default function ProgressPage() {
  const [sequences, setSequences] = useState<any[]>([]);
  const [progress, setProgress] = useState<any[]>([]);
  const [classGroups, setClassGroups] = useState<any[]>([]);
  const [selectedGroup, setSelectedGroup] = useState('');
  const [loading, setLoading] = useState(true);
  const supabase = createSupabaseBrowserClient();

  const load = useCallback(async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    const { data: profile } = await supabase.from('users').select('tenant_id').eq('id', user.id).single();
    if (!profile) return;

    const [seqRes, progRes, cgRes] = await Promise.all([
      supabase.from('learning_sequences').select('id, name, status').eq('tenant_id', profile.tenant_id).eq('status', 'published'),
      supabase.from('student_progress').select('*').order('updated_at', { ascending: false }).limit(500),
      supabase.from('class_groups').select('id, name').eq('tenant_id', profile.tenant_id),
    ]);

    setSequences(seqRes.data ?? []);
    setProgress(progRes.data ?? []);
    setClassGroups(cgRes.data ?? []);
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  const filtered = selectedGroup
    ? progress.filter((p) => p.class_group_id === selectedGroup)
    : progress;

  // Completion stats per sequence
  const seqStats = sequences.map((seq) => {
    const seqProgress = filtered.filter((p) => p.sequence_id === seq.id);
    const completed = seqProgress.filter((p) => p.status === 'completed').length;
    const inProgress = seqProgress.filter((p) => p.status === 'in_progress').length;
    const total = seqProgress.length;
    return { name: seq.name, completed, in_progress: inProgress, not_started: Math.max(0, total - completed - inProgress), total };
  }).filter((s) => s.total > 0);

  // Overall stats
  const totalRecords = filtered.length;
  const completedCount = filtered.filter((p) => p.status === 'completed').length;
  const avgProgress = totalRecords > 0 ? Math.round(filtered.reduce((s, p) => s + (p.progress_pct ?? 0), 0) / totalRecords) : 0;
  const totalWatchTime = filtered.reduce((s, p) => s + (p.watch_time_seconds ?? 0), 0);

  if (loading) return <div className="text-gray-400 py-20 text-center">Loading progress...</div>;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-100">Student Progress</h1>
        <select value={selectedGroup} onChange={(e) => setSelectedGroup(e.target.value)}
          className="rounded-md border border-gray-600 bg-brand-bg px-3 py-1.5 text-sm text-gray-200">
          <option value="">All Class Groups</option>
          {classGroups.map((cg) => <option key={cg.id} value={cg.id}>{cg.name}</option>)}
        </select>
      </div>

      {/* Stats */}
      <div className="grid gap-4 sm:grid-cols-3">
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm text-gray-400">Completion Rate</CardTitle></CardHeader>
          <CardContent>
            <div className="flex items-center gap-2">
              <CheckCircle className="h-5 w-5 text-emerald-400" />
              <span className="text-2xl font-bold text-emerald-400">{totalRecords > 0 ? Math.round(completedCount / totalRecords * 100) : 0}%</span>
            </div>
            <p className="text-xs text-gray-500 mt-1">{completedCount} / {totalRecords} items completed</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm text-gray-400">Average Progress</CardTitle></CardHeader>
          <CardContent>
            <span className="text-2xl font-bold">{avgProgress}%</span>
            <div className="h-2 w-full rounded-full bg-gray-700 mt-2"><div className="h-2 rounded-full bg-brand-primary" style={{ width: `${avgProgress}%` }} /></div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm text-gray-400">Total Watch Time</CardTitle></CardHeader>
          <CardContent>
            <div className="flex items-center gap-2">
              <Clock className="h-5 w-5 text-gray-500" />
              <span className="text-2xl font-bold">{Math.floor(totalWatchTime / 3600)}h {Math.floor((totalWatchTime % 3600) / 60)}m</span>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Per-sequence chart */}
      {seqStats.length > 0 && (
        <Card>
          <CardHeader><CardTitle>Completion by Sequence</CardTitle></CardHeader>
          <CardContent>
            <div className="h-52">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={seqStats} layout="vertical">
                  <XAxis type="number" tick={{ fill: '#9ca3af', fontSize: 11 }} />
                  <YAxis type="category" dataKey="name" tick={{ fill: '#9ca3af', fontSize: 11 }} width={150} />
                  <Tooltip contentStyle={{ background: '#1e2130', border: '1px solid #374151', borderRadius: 8, fontSize: 12 }} />
                  <Bar dataKey="completed" stackId="a" fill="#10b981" name="Completed" />
                  <Bar dataKey="in_progress" stackId="a" fill="#f59e0b" name="In Progress" />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Recent progress */}
      <Card>
        <CardHeader><CardTitle>Recent Activity</CardTitle></CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Student</TableHead>
                <TableHead>Sequence</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Progress</TableHead>
                <TableHead>Watch Time</TableHead>
                <TableHead>Last Updated</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.length === 0 && <TableRow><TableCell colSpan={6} className="text-center text-gray-500">No progress data yet</TableCell></TableRow>}
              {filtered.slice(0, 50).map((p) => (
                <TableRow key={p.id}>
                  <TableCell className="font-mono text-xs">{p.student_id?.slice(0, 8) ?? '—'}</TableCell>
                  <TableCell className="text-sm">{sequences.find((s) => s.id === p.sequence_id)?.name ?? '—'}</TableCell>
                  <TableCell>
                    <Badge variant={p.status === 'completed' ? 'success' : p.status === 'in_progress' ? 'warning' : 'secondary'}>{p.status}</Badge>
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <div className="h-1.5 w-12 rounded-full bg-gray-700">
                        <div className="h-1.5 rounded-full bg-brand-primary" style={{ width: `${p.progress_pct ?? 0}%` }} />
                      </div>
                      <span className="text-xs">{p.progress_pct ?? 0}%</span>
                    </div>
                  </TableCell>
                  <TableCell className="text-xs">{Math.floor((p.watch_time_seconds ?? 0) / 60)}m</TableCell>
                  <TableCell className="text-xs">{p.updated_at ? new Date(p.updated_at).toLocaleString() : '—'}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
