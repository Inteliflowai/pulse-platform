'use client';

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { cn } from '@/lib/utils';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter, DialogDescription } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Plus, BookOpen, GraduationCap, Calendar, Users } from 'lucide-react';

const tabs = [
  { key: 'sequences', label: 'Learning Sequences', icon: BookOpen },
  { key: 'classes', label: 'Class Groups', icon: Users },
  { key: 'setup', label: 'Grades & Subjects', icon: GraduationCap },
] as const;

type TabKey = (typeof tabs)[number]['key'];

export default function CurriculumPage() {
  const [tab, setTab] = useState<TabKey>('sequences');
  const [curriculum, setCurriculum] = useState<any>({ grades: [], subjects: [], terms: [], class_groups: [] });
  const [sequences, setSequences] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const loadCurriculum = useCallback(async () => {
    const res = await fetch('/api/curriculum');
    if (res.ok) setCurriculum(await res.json());
  }, []);

  const loadSequences = useCallback(async () => {
    const res = await fetch('/api/curriculum/sequences');
    if (res.ok) { const d = await res.json(); setSequences(d.sequences ?? []); }
  }, []);

  useEffect(() => { Promise.all([loadCurriculum(), loadSequences()]).then(() => setLoading(false)); }, [loadCurriculum, loadSequences]);

  if (loading) return <div className="text-gray-400 py-20 text-center">Loading...</div>;

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-gray-100">Curriculum</h1>

      <div className="flex border-b border-gray-700">
        {tabs.map((t) => (
          <button key={t.key} onClick={() => setTab(t.key)} className={cn(
            'flex items-center gap-2 px-4 py-2 text-sm font-medium border-b-2 -mb-px transition-colors',
            tab === t.key ? 'border-brand-primary text-brand-primary' : 'border-transparent text-gray-400 hover:text-gray-200'
          )}>
            <t.icon className="h-4 w-4" />{t.label}
          </button>
        ))}
      </div>

      {tab === 'sequences' && <SequencesTab sequences={sequences} curriculum={curriculum} onRefresh={() => { loadSequences(); loadCurriculum(); }} />}
      {tab === 'classes' && <ClassGroupsTab curriculum={curriculum} onRefresh={loadCurriculum} />}
      {tab === 'setup' && <SetupTab curriculum={curriculum} onRefresh={loadCurriculum} />}
    </div>
  );
}

function SequencesTab({ sequences, curriculum, onRefresh }: { sequences: any[]; curriculum: any; onRefresh: () => void }) {
  const [createOpen, setCreateOpen] = useState(false);
  const [form, setForm] = useState({ name: '', description: '', grade_id: '', subject_id: '' });
  const [saving, setSaving] = useState(false);

  async function handleCreate() {
    setSaving(true);
    await fetch('/api/curriculum/sequences', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(form),
    });
    setCreateOpen(false);
    setForm({ name: '', description: '', grade_id: '', subject_id: '' });
    setSaving(false);
    onRefresh();
  }

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <p className="text-sm text-gray-400">{sequences.length} sequence(s)</p>
        <Dialog open={createOpen} onOpenChange={setCreateOpen}>
          <DialogTrigger asChild><Button><Plus className="mr-2 h-4 w-4" />New Sequence</Button></DialogTrigger>
          <DialogContent>
            <DialogHeader><DialogTitle>Create Learning Sequence</DialogTitle><DialogDescription>A sequence is an ordered set of videos, quizzes, and activities.</DialogDescription></DialogHeader>
            <div className="space-y-3">
              <div className="space-y-1"><Label>Name</Label><Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="e.g. Grade 10 Science - Chapter 1" /></div>
              <div className="space-y-1"><Label>Description</Label><Input value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} /></div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1"><Label>Grade</Label>
                  <Select value={form.grade_id} onValueChange={(v) => setForm({ ...form, grade_id: v })}>
                    <SelectTrigger><SelectValue placeholder="Select" /></SelectTrigger>
                    <SelectContent>{curriculum.grades.map((g: any) => <SelectItem key={g.id} value={g.id}>{g.name}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
                <div className="space-y-1"><Label>Subject</Label>
                  <Select value={form.subject_id} onValueChange={(v) => setForm({ ...form, subject_id: v })}>
                    <SelectTrigger><SelectValue placeholder="Select" /></SelectTrigger>
                    <SelectContent>{curriculum.subjects.map((s: any) => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
              </div>
            </div>
            <DialogFooter><Button onClick={handleCreate} disabled={saving || !form.name}>{saving ? 'Creating...' : 'Create'}</Button></DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader><TableRow><TableHead>Name</TableHead><TableHead>Grade</TableHead><TableHead>Subject</TableHead><TableHead>Status</TableHead><TableHead>Created</TableHead></TableRow></TableHeader>
            <TableBody>
              {sequences.length === 0 && <TableRow><TableCell colSpan={5} className="text-center text-gray-500">No sequences yet. Create one to get started.</TableCell></TableRow>}
              {sequences.map((s) => (
                <TableRow key={s.id}>
                  <TableCell><Link href={`/dashboard/school/curriculum/sequences/${s.id}`} className="text-brand-primary hover:underline font-medium">{s.name}</Link></TableCell>
                  <TableCell>{(s as any).grades?.name ?? '—'}</TableCell>
                  <TableCell>{(s as any).subjects?.name ?? '—'}</TableCell>
                  <TableCell><Badge variant={s.status === 'published' ? 'success' : s.status === 'draft' ? 'warning' : 'secondary'}>{s.status}</Badge></TableCell>
                  <TableCell className="text-xs">{new Date(s.created_at).toLocaleDateString()}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}

function ClassGroupsTab({ curriculum, onRefresh }: { curriculum: any; onRefresh: () => void }) {
  const [createOpen, setCreateOpen] = useState(false);
  const [form, setForm] = useState({ name: '', grade_id: '', subject_id: '' });
  const [saving, setSaving] = useState(false);

  async function handleCreate() {
    setSaving(true);
    await fetch('/api/curriculum', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ type: 'class_group', ...form }),
    });
    setCreateOpen(false);
    setForm({ name: '', grade_id: '', subject_id: '' });
    setSaving(false);
    onRefresh();
  }

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <p className="text-sm text-gray-400">{curriculum.class_groups.length} class group(s)</p>
        <Dialog open={createOpen} onOpenChange={setCreateOpen}>
          <DialogTrigger asChild><Button><Plus className="mr-2 h-4 w-4" />New Class Group</Button></DialogTrigger>
          <DialogContent>
            <DialogHeader><DialogTitle>Create Class Group</DialogTitle><DialogDescription>A class group is a set of students for a grade + subject.</DialogDescription></DialogHeader>
            <div className="space-y-3">
              <div className="space-y-1"><Label>Name</Label><Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="e.g. 10A Science" /></div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1"><Label>Grade</Label>
                  <Select value={form.grade_id} onValueChange={(v) => setForm({ ...form, grade_id: v })}>
                    <SelectTrigger><SelectValue placeholder="Select" /></SelectTrigger>
                    <SelectContent>{curriculum.grades.map((g: any) => <SelectItem key={g.id} value={g.id}>{g.name}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
                <div className="space-y-1"><Label>Subject</Label>
                  <Select value={form.subject_id} onValueChange={(v) => setForm({ ...form, subject_id: v })}>
                    <SelectTrigger><SelectValue placeholder="Select" /></SelectTrigger>
                    <SelectContent>{curriculum.subjects.map((s: any) => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
              </div>
            </div>
            <DialogFooter><Button onClick={handleCreate} disabled={saving || !form.name || !form.grade_id || !form.subject_id}>{saving ? 'Creating...' : 'Create'}</Button></DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader><TableRow><TableHead>Name</TableHead><TableHead>Grade</TableHead><TableHead>Subject</TableHead><TableHead>Teacher</TableHead><TableHead>Status</TableHead></TableRow></TableHeader>
            <TableBody>
              {curriculum.class_groups.length === 0 && <TableRow><TableCell colSpan={5} className="text-center text-gray-500">No class groups</TableCell></TableRow>}
              {curriculum.class_groups.map((cg: any) => (
                <TableRow key={cg.id}>
                  <TableCell className="font-medium">{cg.name}</TableCell>
                  <TableCell>{cg.grades?.name ?? '—'}</TableCell>
                  <TableCell>{cg.subjects?.name ?? '—'}</TableCell>
                  <TableCell className="text-sm">{cg.users?.full_name ?? cg.users?.email ?? '—'}</TableCell>
                  <TableCell><Badge variant={cg.status === 'active' ? 'success' : 'secondary'}>{cg.status}</Badge></TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}

function SetupTab({ curriculum, onRefresh }: { curriculum: any; onRefresh: () => void }) {
  const [addType, setAddType] = useState<'grade' | 'subject' | 'term' | null>(null);
  const [name, setName] = useState('');
  const [saving, setSaving] = useState(false);

  async function handleAdd() {
    if (!addType || !name) return;
    setSaving(true);
    await fetch('/api/curriculum', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ type: addType, name, sort_order: addType === 'grade' ? curriculum.grades.length : 0 }),
    });
    setAddType(null);
    setName('');
    setSaving(false);
    onRefresh();
  }

  return (
    <div className="grid gap-6 lg:grid-cols-3">
      {/* Grades */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="text-base">Grades</CardTitle>
            <Button size="sm" variant="ghost" onClick={() => setAddType('grade')}><Plus className="h-4 w-4" /></Button>
          </div>
        </CardHeader>
        <CardContent>
          {curriculum.grades.length === 0 && <p className="text-sm text-gray-500">No grades</p>}
          <div className="space-y-1">{curriculum.grades.map((g: any) => (
            <div key={g.id} className="flex items-center justify-between rounded px-2 py-1.5 text-sm bg-brand-bg">{g.name}</div>
          ))}</div>
        </CardContent>
      </Card>

      {/* Subjects */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="text-base">Subjects</CardTitle>
            <Button size="sm" variant="ghost" onClick={() => setAddType('subject')}><Plus className="h-4 w-4" /></Button>
          </div>
        </CardHeader>
        <CardContent>
          {curriculum.subjects.length === 0 && <p className="text-sm text-gray-500">No subjects</p>}
          <div className="space-y-1">{curriculum.subjects.map((s: any) => (
            <div key={s.id} className="flex items-center gap-2 rounded px-2 py-1.5 text-sm bg-brand-bg">
              <div className="h-3 w-3 rounded-full" style={{ background: s.color }} />{s.name}
            </div>
          ))}</div>
        </CardContent>
      </Card>

      {/* Terms */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="text-base">Terms</CardTitle>
            <Button size="sm" variant="ghost" onClick={() => setAddType('term')}><Plus className="h-4 w-4" /></Button>
          </div>
        </CardHeader>
        <CardContent>
          {curriculum.terms.length === 0 && <p className="text-sm text-gray-500">No terms</p>}
          <div className="space-y-1">{curriculum.terms.map((t: any) => (
            <div key={t.id} className="flex items-center justify-between rounded px-2 py-1.5 text-sm bg-brand-bg">
              {t.name}{t.is_active && <Badge variant="success" className="text-[10px]">Active</Badge>}
            </div>
          ))}</div>
        </CardContent>
      </Card>

      {/* Add dialog */}
      <Dialog open={addType !== null} onOpenChange={() => setAddType(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>Add {addType}</DialogTitle><DialogDescription>Enter a name for the new {addType}.</DialogDescription></DialogHeader>
          <div className="space-y-2"><Label>Name</Label><Input value={name} onChange={(e) => setName(e.target.value)} placeholder={addType === 'grade' ? 'e.g. Grade 10' : addType === 'subject' ? 'e.g. Mathematics' : 'e.g. Term 1 2026'} autoFocus /></div>
          <DialogFooter><Button onClick={handleAdd} disabled={saving || !name}>{saving ? 'Adding...' : 'Add'}</Button></DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
