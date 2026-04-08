'use client';

import { useState, useEffect, useCallback } from 'react';
import { useParams } from 'next/navigation';
import { createSupabaseBrowserClient } from '@/lib/supabase/browser';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter, DialogDescription } from '@/components/ui/dialog';
import { ArrowLeft, Play, FileText, HelpCircle, Plus, GripVertical, Trash2 } from 'lucide-react';
import Link from 'next/link';

const itemIcons: Record<string, any> = { video: Play, document: FileText, quiz: HelpCircle, interactive: Play, break: FileText };
const itemColors: Record<string, string> = { video: 'text-blue-400', quiz: 'text-yellow-400', document: 'text-green-400', interactive: 'text-purple-400', break: 'text-gray-400' };

export default function SequenceDetailPage() {
  const { sequenceId } = useParams<{ sequenceId: string }>();
  const [sequence, setSequence] = useState<any>(null);
  const [items, setItems] = useState<any[]>([]);
  const [assets, setAssets] = useState<any[]>([]);
  const [quizzes, setQuizzes] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [addOpen, setAddOpen] = useState(false);
  const [addForm, setAddForm] = useState({ item_type: 'video', title: '', asset_id: '', quiz_id: '', duration_minutes: '', auto_advance: true, require_completion: true });
  const [createQuizOpen, setCreateQuizOpen] = useState(false);
  const [quizForm, setQuizForm] = useState({ title: '', time_limit_minutes: '', pass_percentage: '50', questions: [{ question_type: 'multiple_choice', question_text: '', options: [{ id: '1', text: '', is_correct: true }, { id: '2', text: '', is_correct: false }, { id: '3', text: '', is_correct: false }, { id: '4', text: '', is_correct: false }], points: 1 }] as any[] });

  const supabase = createSupabaseBrowserClient();

  const load = useCallback(async () => {
    const res = await fetch(`/api/curriculum/sequences/${sequenceId}`);
    if (res.ok) {
      const data = await res.json();
      setSequence(data.sequence);
      setItems(data.items);
    }

    const { data: { user } } = await supabase.auth.getUser();
    if (user) {
      const { data: profile } = await supabase.from('users').select('tenant_id').eq('id', user.id).single();
      if (profile) {
        const { data: a } = await supabase.from('assets').select('id, filename, mime_type').eq('tenant_id', profile.tenant_id).eq('status', 'ready');
        setAssets(a ?? []);
        const { data: q } = await supabase.from('quiz_definitions').select('id, title, status').eq('tenant_id', profile.tenant_id);
        setQuizzes(q ?? []);
      }
    }
    setLoading(false);
  }, [sequenceId]);

  useEffect(() => { load(); }, [load]);

  async function addItem() {
    const admin = supabase;
    await admin.from('sequence_items').insert({
      sequence_id: sequenceId,
      sort_order: items.length,
      item_type: addForm.item_type,
      title: addForm.title,
      asset_id: addForm.asset_id || null,
      quiz_id: addForm.quiz_id || null,
      duration_minutes: addForm.duration_minutes ? parseInt(addForm.duration_minutes) : null,
      auto_advance: addForm.auto_advance,
      require_completion: addForm.require_completion,
    });
    setAddOpen(false);
    setAddForm({ item_type: 'video', title: '', asset_id: '', quiz_id: '', duration_minutes: '', auto_advance: true, require_completion: true });
    load();
  }

  async function removeItem(id: string) {
    await supabase.from('sequence_items').delete().eq('id', id);
    load();
  }

  async function publishSequence() {
    await fetch(`/api/curriculum/sequences/${sequenceId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: 'published' }),
    });
    load();
  }

  async function createQuiz() {
    const res = await fetch('/api/quiz', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        ...quizForm,
        time_limit_minutes: quizForm.time_limit_minutes ? parseInt(quizForm.time_limit_minutes) : null,
        pass_percentage: parseInt(quizForm.pass_percentage),
        sequence_id: sequenceId,
      }),
    });
    if (res.ok) {
      const quiz = await res.json();
      // Publish it
      await fetch(`/api/quiz/${quiz.id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ status: 'published' }) });
      setCreateQuizOpen(false);
      setQuizForm({ title: '', time_limit_minutes: '', pass_percentage: '50', questions: [{ question_type: 'multiple_choice', question_text: '', options: [{ id: '1', text: '', is_correct: true }, { id: '2', text: '', is_correct: false }, { id: '3', text: '', is_correct: false }, { id: '4', text: '', is_correct: false }], points: 1 }] });
      load();
    }
  }

  function addQuestion() {
    setQuizForm({
      ...quizForm,
      questions: [...quizForm.questions, { question_type: 'multiple_choice', question_text: '', options: [{ id: crypto.randomUUID(), text: '', is_correct: true }, { id: crypto.randomUUID(), text: '', is_correct: false }], points: 1 }],
    });
  }

  function updateQuestion(idx: number, field: string, value: any) {
    const q = [...quizForm.questions];
    q[idx] = { ...q[idx], [field]: value };
    setQuizForm({ ...quizForm, questions: q });
  }

  function updateOption(qIdx: number, oIdx: number, field: string, value: any) {
    const q = [...quizForm.questions];
    const opts = [...q[qIdx].options];
    if (field === 'is_correct') {
      opts.forEach((o: any, i: number) => { o.is_correct = i === oIdx; });
    } else {
      opts[oIdx] = { ...opts[oIdx], [field]: value };
    }
    q[qIdx] = { ...q[qIdx], options: opts };
    setQuizForm({ ...quizForm, questions: q });
  }

  if (loading) return <div className="text-gray-400 py-20 text-center">Loading...</div>;
  if (!sequence) return <div className="text-gray-400 py-20 text-center">Sequence not found</div>;

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <Link href="/dashboard/school/curriculum" className="text-gray-400 hover:text-gray-200"><ArrowLeft className="h-5 w-5" /></Link>
        <h1 className="text-2xl font-bold text-gray-100">{sequence.name}</h1>
        <Badge variant={sequence.status === 'published' ? 'success' : 'warning'}>{sequence.status}</Badge>
      </div>

      {sequence.description && <p className="text-gray-400">{sequence.description}</p>}

      <div className="flex gap-2">
        {sequence.status === 'draft' && <Button onClick={publishSequence}>Publish Sequence</Button>}
        <Dialog open={addOpen} onOpenChange={setAddOpen}>
          <DialogTrigger asChild><Button variant="outline"><Plus className="mr-2 h-4 w-4" />Add Item</Button></DialogTrigger>
          <DialogContent>
            <DialogHeader><DialogTitle>Add Sequence Item</DialogTitle><DialogDescription>Add a video, quiz, or document to this sequence.</DialogDescription></DialogHeader>
            <div className="space-y-3">
              <div className="space-y-1"><Label>Type</Label>
                <Select value={addForm.item_type} onValueChange={(v) => setAddForm({ ...addForm, item_type: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="video">Video</SelectItem>
                    <SelectItem value="quiz">Quiz</SelectItem>
                    <SelectItem value="document">Document</SelectItem>
                    <SelectItem value="break">Break</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1"><Label>Title</Label><Input value={addForm.title} onChange={(e) => setAddForm({ ...addForm, title: e.target.value })} /></div>
              {(addForm.item_type === 'video' || addForm.item_type === 'document') && (
                <div className="space-y-1"><Label>Asset</Label>
                  <Select value={addForm.asset_id} onValueChange={(v) => setAddForm({ ...addForm, asset_id: v })}>
                    <SelectTrigger><SelectValue placeholder="Select asset" /></SelectTrigger>
                    <SelectContent>{assets.filter((a) => addForm.item_type === 'video' ? a.mime_type?.startsWith('video') : true).map((a) => <SelectItem key={a.id} value={a.id}>{a.filename}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
              )}
              {addForm.item_type === 'quiz' && (
                <div className="space-y-1"><Label>Quiz</Label>
                  <Select value={addForm.quiz_id} onValueChange={(v) => setAddForm({ ...addForm, quiz_id: v })}>
                    <SelectTrigger><SelectValue placeholder="Select quiz" /></SelectTrigger>
                    <SelectContent>{quizzes.map((q) => <SelectItem key={q.id} value={q.id}>{q.title}</SelectItem>)}</SelectContent>
                  </Select>
                  <Button variant="ghost" size="sm" onClick={() => { setAddOpen(false); setCreateQuizOpen(true); }} className="text-xs mt-1">or create new quiz</Button>
                </div>
              )}
              <div className="flex items-center gap-4">
                <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={addForm.auto_advance} onChange={(e) => setAddForm({ ...addForm, auto_advance: e.target.checked })} />Auto-advance</label>
                <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={addForm.require_completion} onChange={(e) => setAddForm({ ...addForm, require_completion: e.target.checked })} />Required</label>
              </div>
            </div>
            <DialogFooter><Button onClick={addItem} disabled={!addForm.title}>Add</Button></DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      {/* Sequence timeline */}
      <Card>
        <CardHeader><CardTitle>Sequence Items ({items.length})</CardTitle></CardHeader>
        <CardContent>
          {items.length === 0 && <p className="text-gray-500 text-sm py-4 text-center">No items yet. Add videos and quizzes to build the learning flow.</p>}
          <div className="space-y-2">
            {items.map((item, i) => {
              const Icon = itemIcons[item.item_type] ?? FileText;
              const color = itemColors[item.item_type] ?? 'text-gray-400';
              return (
                <div key={item.id} className="flex items-center gap-3 rounded-lg border border-gray-700 bg-brand-bg p-3">
                  <span className="text-xs text-gray-500 w-6 text-center">{i + 1}</span>
                  <div className={`h-8 w-8 rounded-lg bg-brand-surface flex items-center justify-center ${color}`}><Icon className="h-4 w-4" /></div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">{item.title}</p>
                    <p className="text-xs text-gray-500">{item.item_type}{item.assets?.filename ? ` — ${item.assets.filename}` : ''}{item.quiz_definitions?.title ? ` — ${item.quiz_definitions.title}` : ''}</p>
                  </div>
                  <div className="flex items-center gap-2 text-xs text-gray-500">
                    {item.auto_advance && <Badge variant="outline" className="text-[10px]">Auto</Badge>}
                    {item.require_completion && <Badge variant="outline" className="text-[10px]">Required</Badge>}
                    <button onClick={() => removeItem(item.id)} className="text-gray-500 hover:text-red-400"><Trash2 className="h-3.5 w-3.5" /></button>
                  </div>
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>

      {/* Create Quiz dialog */}
      <Dialog open={createQuizOpen} onOpenChange={setCreateQuizOpen}>
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
          <DialogHeader><DialogTitle>Create Quiz</DialogTitle><DialogDescription>Add questions for students to answer after watching the video.</DialogDescription></DialogHeader>
          <div className="space-y-4">
            <div className="grid grid-cols-3 gap-3">
              <div className="space-y-1"><Label>Title</Label><Input value={quizForm.title} onChange={(e) => setQuizForm({ ...quizForm, title: e.target.value })} /></div>
              <div className="space-y-1"><Label>Time Limit (min)</Label><Input type="number" value={quizForm.time_limit_minutes} onChange={(e) => setQuizForm({ ...quizForm, time_limit_minutes: e.target.value })} /></div>
              <div className="space-y-1"><Label>Pass %</Label><Input type="number" value={quizForm.pass_percentage} onChange={(e) => setQuizForm({ ...quizForm, pass_percentage: e.target.value })} /></div>
            </div>

            <div className="space-y-3">
              <div className="flex items-center justify-between"><Label>Questions</Label><Button size="sm" variant="ghost" onClick={addQuestion}><Plus className="h-3 w-3 mr-1" />Add Question</Button></div>
              {quizForm.questions.map((q: any, qi: number) => (
                <div key={qi} className="rounded-lg border border-gray-700 p-3 space-y-2">
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-gray-500">Q{qi + 1}</span>
                    <Input value={q.question_text} onChange={(e) => updateQuestion(qi, 'question_text', e.target.value)} placeholder="Question text..." className="flex-1" />
                  </div>
                  <div className="pl-6 space-y-1">
                    {q.options.map((opt: any, oi: number) => (
                      <div key={oi} className="flex items-center gap-2">
                        <input type="radio" name={`q${qi}_correct`} checked={opt.is_correct} onChange={() => updateOption(qi, oi, 'is_correct', true)} />
                        <Input value={opt.text} onChange={(e) => updateOption(qi, oi, 'text', e.target.value)} placeholder={`Option ${oi + 1}`} className="h-7 text-xs flex-1" />
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>
          <DialogFooter><Button onClick={createQuiz} disabled={!quizForm.title || quizForm.questions.length === 0}>Create Quiz</Button></DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
