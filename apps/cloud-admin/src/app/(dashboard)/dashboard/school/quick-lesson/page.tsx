'use client';

import { useState, useEffect, useCallback } from 'react';
import { createSupabaseBrowserClient } from '@/lib/supabase/browser';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Upload, Check, ArrowRight, Loader2 } from 'lucide-react';

const GRADE_BANDS = ['K-2', '3-5', '6-8', '9-12'];

export default function QuickLessonPage() {
  const [step, setStep] = useState(1);
  const [assets, setAssets] = useState<any[]>([]);
  const [classGroups, setClassGroups] = useState<any[]>([]);
  const [classrooms, setClassrooms] = useState<any[]>([]);
  const [selectedAsset, setSelectedAsset] = useState<any>(null);
  const [assetSearch, setAssetSearch] = useState('');
  const [form, setForm] = useState({
    title: '', subject: '', grade_band: '', class_group_id: '',
    classroom_id: '', scheduled_date: '', scheduled_time: '08:00',
    duration_minutes: 60, lesson_plan_text: '', generate_quiz: true,
  });
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState<any>(null);

  const supabase = createSupabaseBrowserClient();

  const load = useCallback(async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    const { data: profile } = await supabase.from('users').select('tenant_id, site_id').eq('id', user.id).single();
    if (!profile) return;

    const [a, cg, cr] = await Promise.all([
      supabase.from('assets').select('id, filename, mime_type, size_bytes').eq('tenant_id', profile.tenant_id).eq('status', 'ready').order('created_at', { ascending: false }),
      supabase.from('class_groups').select('id, name, grades(name), subjects(name)').eq('tenant_id', profile.tenant_id).eq('status', 'active').order('name'),
      supabase.from('classrooms').select('id, name, room_code, nodes(name, status)').eq('site_id', profile.site_id ?? '').order('name'),
    ]);
    setAssets(a.data ?? []);
    setClassGroups(cg.data ?? []);
    setClassrooms(cr.data ?? []);
  }, [supabase]);

  useEffect(() => { load(); }, [load]);

  function selectAsset(asset: any) {
    setSelectedAsset(asset);
    if (!form.title) {
      const name = asset.filename?.replace(/\.[^.]+$/, '') ?? '';
      setForm(f => ({ ...f, title: name }));
    }
  }

  async function handleSubmit() {
    if (!selectedAsset) return;
    setSubmitting(true);

    const res = await fetch('/api/quick-lesson', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        asset_id: selectedAsset.id,
        title: form.title,
        subject: form.subject,
        grade_band: form.grade_band,
        class_group_id: form.class_group_id,
        classroom_id: form.classroom_id,
        scheduled_date: form.scheduled_date || null,
        scheduled_time: form.scheduled_time,
        duration_minutes: form.duration_minutes,
        lesson_plan_text: form.lesson_plan_text || null,
        generate_quiz: form.generate_quiz,
      }),
    });

    if (res.ok) {
      setResult(await res.json());
    }
    setSubmitting(false);
  }

  const filteredAssets = assets.filter(a =>
    !assetSearch || a.filename?.toLowerCase().includes(assetSearch.toLowerCase())
  );

  if (result) {
    return (
      <div className="p-6 max-w-lg mx-auto">
        <Card>
          <CardContent className="p-8 text-center space-y-4">
            <div className="mx-auto w-16 h-16 bg-green-500/15 border-2 border-green-500 rounded-full flex items-center justify-center">
              <Check className="h-8 w-8 text-green-500" />
            </div>
            <h2 className="text-xl font-bold">Lesson Scheduled!</h2>
            <p className="text-muted-foreground text-sm">{form.title} has been scheduled.</p>
            <div className="text-xs space-y-1 text-muted-foreground">
              {result.sync_job_id && <p>Sync job created — content will be delivered to the node.</p>}
              {result.quiz_generation_status === 'requested' && <p>Quiz generation requested from CORE.</p>}
              {result.quiz_generation_status === 'unavailable' && <p>Quiz auto-generation is not available in this environment — you can attach a quiz manually.</p>}
            </div>
            <div className="flex gap-2 justify-center pt-4">
              <Button variant="outline" onClick={() => { setStep(1); setResult(null); setSelectedAsset(null); setForm({ title: '', subject: '', grade_band: '', class_group_id: '', classroom_id: '', scheduled_date: '', scheduled_time: '08:00', duration_minutes: 60, lesson_plan_text: '', generate_quiz: true }); }}>
                Schedule Another
              </Button>
              <Button onClick={() => window.location.href = '/dashboard/school/schedule'}>
                View Schedule
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="p-6 max-w-2xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Quick Lesson</h1>
        <p className="text-sm text-muted-foreground mt-1">Upload or select a video, configure, and schedule in 3 steps.</p>
      </div>

      {/* Step indicators */}
      <div className="flex items-center gap-2">
        {[1, 2, 3].map(s => (
          <div key={s} className="flex items-center gap-2">
            <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold ${step >= s ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground'}`}>
              {step > s ? <Check className="h-4 w-4" /> : s}
            </div>
            {s < 3 && <div className={`w-12 h-0.5 ${step > s ? 'bg-primary' : 'bg-muted'}`} />}
          </div>
        ))}
      </div>

      {/* Step 1: Select asset */}
      {step === 1 && (
        <Card>
          <CardContent className="p-6 space-y-4">
            <h2 className="text-lg font-semibold">Select a Video</h2>
            <Input
              placeholder="Search assets..."
              value={assetSearch}
              onChange={e => setAssetSearch(e.target.value)}
            />
            <div className="max-h-64 overflow-y-auto space-y-2">
              {filteredAssets.map(a => (
                <div
                  key={a.id}
                  className={`p-3 rounded-lg border cursor-pointer transition-colors ${selectedAsset?.id === a.id ? 'border-primary bg-primary/5' : 'border-border hover:border-primary/50'}`}
                  onClick={() => selectAsset(a)}
                >
                  <div className="font-medium text-sm">{a.filename}</div>
                  <div className="text-xs text-muted-foreground">{a.mime_type} · {((a.size_bytes ?? 0) / 1e6).toFixed(1)} MB</div>
                </div>
              ))}
              {filteredAssets.length === 0 && <p className="text-center text-muted-foreground text-sm py-4">No assets found</p>}
            </div>
            <Button onClick={() => setStep(2)} disabled={!selectedAsset}>
              Next <ArrowRight className="h-4 w-4 ml-1" />
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Step 2: Configure */}
      {step === 2 && (
        <Card>
          <CardContent className="p-6 space-y-4">
            <h2 className="text-lg font-semibold">Configure Lesson</h2>
            <div>
              <Label>Lesson Title</Label>
              <Input value={form.title} onChange={e => setForm(f => ({ ...f, title: e.target.value }))} />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Subject</Label>
                <Input value={form.subject} onChange={e => setForm(f => ({ ...f, subject: e.target.value }))} />
              </div>
              <div>
                <Label>Grade Band</Label>
                <Select value={form.grade_band} onValueChange={v => setForm(f => ({ ...f, grade_band: v }))}>
                  <SelectTrigger><SelectValue placeholder="Select" /></SelectTrigger>
                  <SelectContent>{GRADE_BANDS.map(g => <SelectItem key={g} value={g}>{g}</SelectItem>)}</SelectContent>
                </Select>
              </div>
            </div>
            <div>
              <Label>Class Group</Label>
              <Select value={form.class_group_id} onValueChange={v => setForm(f => ({ ...f, class_group_id: v }))}>
                <SelectTrigger><SelectValue placeholder="Select class" /></SelectTrigger>
                <SelectContent>{classGroups.map((g: any) => <SelectItem key={g.id} value={g.id}>{g.name}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div>
              <Label>Classroom</Label>
              <Select value={form.classroom_id} onValueChange={v => setForm(f => ({ ...f, classroom_id: v }))}>
                <SelectTrigger><SelectValue placeholder="Select room" /></SelectTrigger>
                <SelectContent>{classrooms.map((r: any) => <SelectItem key={r.id} value={r.id}>{r.name}{r.room_code ? ` (${r.room_code})` : ''}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-3 gap-4">
              <div>
                <Label>Date</Label>
                <Input type="date" value={form.scheduled_date} onChange={e => setForm(f => ({ ...f, scheduled_date: e.target.value }))} />
              </div>
              <div>
                <Label>Time</Label>
                <Input type="time" value={form.scheduled_time} onChange={e => setForm(f => ({ ...f, scheduled_time: e.target.value }))} />
              </div>
              <div>
                <Label>Duration</Label>
                <Select value={String(form.duration_minutes)} onValueChange={v => setForm(f => ({ ...f, duration_minutes: parseInt(v) }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>{[30, 45, 60, 90, 120].map(d => <SelectItem key={d} value={String(d)}>{d} min</SelectItem>)}</SelectContent>
                </Select>
              </div>
            </div>
            <div className="flex gap-2">
              <Button variant="outline" onClick={() => setStep(1)}>Back</Button>
              <Button onClick={() => setStep(3)} disabled={!form.title || !form.class_group_id || !form.classroom_id}>
                Next <ArrowRight className="h-4 w-4 ml-1" />
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Step 3: Confirm */}
      {step === 3 && (
        <Card>
          <CardContent className="p-6 space-y-4">
            <h2 className="text-lg font-semibold">Confirm & Schedule</h2>
            <div className="bg-muted rounded-lg p-4 space-y-2 text-sm">
              <div className="flex justify-between"><span className="text-muted-foreground">Video:</span><span className="font-medium">{selectedAsset?.filename}</span></div>
              <div className="flex justify-between"><span className="text-muted-foreground">Title:</span><span className="font-medium">{form.title}</span></div>
              <div className="flex justify-between"><span className="text-muted-foreground">Class:</span><span className="font-medium">{classGroups.find((g: any) => g.id === form.class_group_id)?.name ?? ''}</span></div>
              <div className="flex justify-between"><span className="text-muted-foreground">Room:</span><span className="font-medium">{classrooms.find((r: any) => r.id === form.classroom_id)?.name ?? ''}</span></div>
              <div className="flex justify-between"><span className="text-muted-foreground">When:</span><span className="font-medium">{form.scheduled_date || 'Today'} at {form.scheduled_time}</span></div>
              <div className="flex justify-between"><span className="text-muted-foreground">Duration:</span><span className="font-medium">{form.duration_minutes} min</span></div>
            </div>
            <div className="flex gap-2">
              <Button variant="outline" onClick={() => setStep(2)}>Back</Button>
              <Button onClick={handleSubmit} disabled={submitting}>
                {submitting ? <><Loader2 className="h-4 w-4 animate-spin mr-1" /> Scheduling...</> : 'Schedule Lesson'}
              </Button>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
