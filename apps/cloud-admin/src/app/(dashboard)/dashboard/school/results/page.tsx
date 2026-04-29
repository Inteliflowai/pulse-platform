'use client';

import { useState, useEffect, useCallback } from 'react';
import { createSupabaseBrowserClient } from '@/lib/supabase/browser';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Input } from '@/components/ui/input';
import { BarChart, Bar, XAxis, YAxis, ResponsiveContainer, Tooltip, PieChart, Pie, Cell } from 'recharts';
import { CheckCircle, XCircle, Clock, Users } from 'lucide-react';

const COLORS = ['#10b981', '#ef4444', '#f59e0b', '#f26522'];

export default function ResultsPage() {
  const [quizzes, setQuizzes] = useState<any[]>([]);
  const [attempts, setAttempts] = useState<any[]>([]);
  const [selectedQuiz, setSelectedQuiz] = useState<string>('');
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const supabase = createSupabaseBrowserClient();

  const load = useCallback(async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    const { data: profile } = await supabase.from('users').select('tenant_id').eq('id', user.id).single();
    if (!profile) return;

    // Load quizzes
    const { data: q } = await supabase
      .from('quiz_definitions')
      .select('id, title, pass_percentage, status')
      .eq('tenant_id', profile.tenant_id)
      .order('created_at', { ascending: false });
    setQuizzes(q ?? []);

    // Load all attempts
    const { data: a } = await supabase
      .from('quiz_attempts')
      .select('*, quiz_definitions(title)')
      .eq('status', 'completed')
      .order('completed_at', { ascending: false })
      .limit(500);
    setAttempts(a ?? []);

    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  // Filter attempts
  const filteredAttempts = attempts.filter((a) => {
    if (selectedQuiz && a.quiz_id !== selectedQuiz) return false;
    if (search && !(a.student_id ?? '').toLowerCase().includes(search.toLowerCase())) return false;
    return true;
  });

  // Stats
  const totalAttempts = filteredAttempts.length;
  const passed = filteredAttempts.filter((a) => a.passed).length;
  const failed = totalAttempts - passed;
  const avgScore = totalAttempts > 0
    ? Math.round(filteredAttempts.reduce((s, a) => s + (a.percentage ?? 0), 0) / totalAttempts)
    : 0;
  const uniqueStudents = new Set(filteredAttempts.map((a) => a.student_id)).size;

  // Score distribution for chart
  const scoreRanges = [
    { range: '0-20%', count: 0 }, { range: '21-40%', count: 0 },
    { range: '41-60%', count: 0 }, { range: '61-80%', count: 0 }, { range: '81-100%', count: 0 },
  ];
  filteredAttempts.forEach((a) => {
    const p = a.percentage ?? 0;
    if (p <= 20) scoreRanges[0].count++;
    else if (p <= 40) scoreRanges[1].count++;
    else if (p <= 60) scoreRanges[2].count++;
    else if (p <= 80) scoreRanges[3].count++;
    else scoreRanges[4].count++;
  });

  const passFailData = [
    { name: 'Passed', value: passed },
    { name: 'Failed', value: failed },
  ];

  if (loading) return <div className="text-gray-400 py-20 text-center">Loading results...</div>;

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-gray-100">Quiz Results</h1>

      {/* Filters */}
      <div className="flex gap-3">
        <select
          value={selectedQuiz}
          onChange={(e) => setSelectedQuiz(e.target.value)}
          className="rounded-md border border-gray-600 bg-brand-bg px-3 py-1.5 text-sm text-gray-200"
        >
          <option value="">All Quizzes</option>
          {quizzes.map((q) => <option key={q.id} value={q.id}>{q.title}</option>)}
        </select>
        <Input placeholder="Search by student ID..." value={search} onChange={(e) => setSearch(e.target.value)} className="max-w-xs" />
      </div>

      {/* Summary stats */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm text-gray-400">Total Attempts</CardTitle></CardHeader>
          <CardContent><div className="flex items-center gap-2"><Clock className="h-5 w-5 text-gray-500" /><span className="text-2xl font-bold">{totalAttempts}</span></div></CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm text-gray-400">Pass Rate</CardTitle></CardHeader>
          <CardContent><div className="flex items-center gap-2"><CheckCircle className="h-5 w-5 text-emerald-400" /><span className="text-2xl font-bold text-emerald-400">{totalAttempts > 0 ? Math.round(passed / totalAttempts * 100) : 0}%</span></div></CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm text-gray-400">Average Score</CardTitle></CardHeader>
          <CardContent><span className="text-2xl font-bold">{avgScore}%</span></CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm text-gray-400">Students</CardTitle></CardHeader>
          <CardContent><div className="flex items-center gap-2"><Users className="h-5 w-5 text-gray-500" /><span className="text-2xl font-bold">{uniqueStudents}</span></div></CardContent>
        </Card>
      </div>

      {/* Charts */}
      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader><CardTitle>Score Distribution</CardTitle></CardHeader>
          <CardContent>
            <div className="h-48">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={scoreRanges}>
                  <XAxis dataKey="range" tick={{ fill: '#9ca3af', fontSize: 11 }} />
                  <YAxis tick={{ fill: '#9ca3af', fontSize: 11 }} allowDecimals={false} />
                  <Tooltip contentStyle={{ background: '#1e2130', border: '1px solid #374151', borderRadius: 8, fontSize: 12 }} />
                  <Bar dataKey="count" fill="#f26522" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader><CardTitle>Pass / Fail</CardTitle></CardHeader>
          <CardContent>
            <div className="h-48 flex items-center justify-center">
              {totalAttempts > 0 ? (
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie data={passFailData} cx="50%" cy="50%" outerRadius={70} dataKey="value" label={({ name, value }) => `${name}: ${value}`}>
                      <Cell fill="#10b981" />
                      <Cell fill="#ef4444" />
                    </Pie>
                    <Tooltip contentStyle={{ background: '#1e2130', border: '1px solid #374151', borderRadius: 8, fontSize: 12 }} />
                  </PieChart>
                </ResponsiveContainer>
              ) : (
                <p className="text-gray-500 text-sm">No data yet</p>
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Results table */}
      <Card>
        <CardHeader><CardTitle>All Attempts ({filteredAttempts.length})</CardTitle></CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Quiz</TableHead>
                <TableHead>Student</TableHead>
                <TableHead>Score</TableHead>
                <TableHead>Percentage</TableHead>
                <TableHead>Result</TableHead>
                <TableHead>Completed</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredAttempts.length === 0 && (
                <TableRow><TableCell colSpan={6} className="text-center text-gray-500">No quiz attempts yet</TableCell></TableRow>
              )}
              {filteredAttempts.map((a) => (
                <TableRow key={a.id}>
                  <TableCell className="font-medium">{(a as any).quiz_definitions?.title ?? '—'}</TableCell>
                  <TableCell className="font-mono text-xs">{a.student_id?.slice(0, 8) ?? '—'}</TableCell>
                  <TableCell>{a.score ?? 0} / {a.max_score ?? 0}</TableCell>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <div className="h-1.5 w-16 rounded-full bg-gray-700">
                        <div className={`h-1.5 rounded-full ${(a.percentage ?? 0) >= 50 ? 'bg-emerald-400' : 'bg-red-400'}`} style={{ width: `${Math.min(a.percentage ?? 0, 100)}%` }} />
                      </div>
                      <span className="text-xs">{a.percentage ?? 0}%</span>
                    </div>
                  </TableCell>
                  <TableCell>
                    {a.passed ? (
                      <Badge variant="success"><CheckCircle className="h-3 w-3 mr-1" />Passed</Badge>
                    ) : (
                      <Badge variant="destructive"><XCircle className="h-3 w-3 mr-1" />Failed</Badge>
                    )}
                  </TableCell>
                  <TableCell className="text-xs">{a.completed_at ? new Date(a.completed_at).toLocaleString() : '—'}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
