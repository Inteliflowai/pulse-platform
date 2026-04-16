'use client';

import { useState, useEffect, useCallback } from 'react';
import { createSupabaseBrowserClient } from '@/lib/supabase/browser';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Plus, ChevronLeft, ChevronRight, Clock, Users, BookOpen, Trash2 } from 'lucide-react';

const HOURS = Array.from({ length: 14 }, (_, i) => i + 7); // 7:00 to 20:00
const DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
const DURATION_OPTIONS = [30, 45, 60, 90, 120];
const RECURRENCE_OPTIONS = [
  { value: 'once', label: 'Once' },
  { value: 'daily', label: 'Daily' },
  { value: 'weekdays', label: 'Weekdays (Mon–Fri)' },
  { value: 'weekly', label: 'Weekly' },
  { value: 'custom', label: 'Custom days' },
];

function getWeekDates(offset: number): Date[] {
  const now = new Date();
  const monday = new Date(now);
  monday.setDate(now.getDate() - (now.getDay() || 7) + 1 + offset * 7);
  return Array.from({ length: 7 }, (_, i) => {
    const d = new Date(monday);
    d.setDate(monday.getDate() + i);
    return d;
  });
}

function fmt(d: Date) { return d.toISOString().split('T')[0]; }
function fmtShort(d: Date) { return d.toLocaleDateString('en', { month: 'short', day: 'numeric' }); }

interface ScheduleForm {
  classroom_id: string;
  class_group_id: string;
  sequence_id: string;
  teacher_id: string;
  scheduled_date: string;
  scheduled_time: string;
  duration_minutes: number;
  recurrence: string;
  recurrence_days: number[];
  recurrence_end_date: string;
  notes: string;
}

const emptyForm: ScheduleForm = {
  classroom_id: '', class_group_id: '', sequence_id: '', teacher_id: '',
  scheduled_date: '', scheduled_time: '08:00', duration_minutes: 60,
  recurrence: 'once', recurrence_days: [], recurrence_end_date: '', notes: '',
};

export default function SchedulePage() {
  const [schedules, setSchedules] = useState<any[]>([]);
  const [classrooms, setClassrooms] = useState<any[]>([]);
  const [classGroups, setClassGroups] = useState<any[]>([]);
  const [sequences, setSequences] = useState<any[]>([]);
  const [teachers, setTeachers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [weekOffset, setWeekOffset] = useState(0);
  const [createOpen, setCreateOpen] = useState(false);
  const [form, setForm] = useState<ScheduleForm>({ ...emptyForm });
  const [saving, setSaving] = useState(false);
  const [siteId, setSiteId] = useState('');
  const [userRole, setUserRole] = useState('');
  const [userId, setUserId] = useState('');
  const [warning, setWarning] = useState('');

  const supabase = createSupabaseBrowserClient();
  const weekDates = getWeekDates(weekOffset);

  const load = useCallback(async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    setUserId(user.id);
    const { data: profile } = await supabase.from('users').select('tenant_id, site_id, role').eq('id', user.id).single();
    if (!profile) return;
    setSiteId(profile.site_id ?? '');
    setUserRole(profile.role);

    const dates = getWeekDates(weekOffset);
    const dateFrom = fmt(dates[0]);
    const dateTo = fmt(dates[6]);

    // Fetch schedules
    let url = `/api/schedules?date_from=${dateFrom}&date_to=${dateTo}`;
    if (profile.site_id) url += `&site_id=${profile.site_id}`;
    if (profile.role === 'teacher') url += `&teacher_id=${user.id}`;

    const schedRes = await fetch(url);
    if (schedRes.ok) {
      const d = await schedRes.json();
      setSchedules(d.schedules ?? []);
    }

    // Fetch reference data
    const [clsRes, cgRes, seqRes] = await Promise.all([
      supabase.from('classrooms').select('id, name, room_code').eq('site_id', profile.site_id ?? '').order('name'),
      supabase.from('class_groups').select('id, name, teacher_id, grades(name), subjects(name)').eq('tenant_id', profile.tenant_id).eq('status', 'active').order('name'),
      supabase.from('learning_sequences').select('id, name').eq('tenant_id', profile.tenant_id).eq('status', 'published').order('name'),
    ]);

    setClassrooms(clsRes.data ?? []);

    // For teachers, filter class groups to their own
    const cg = cgRes.data ?? [];
    setClassGroups(profile.role === 'teacher' ? cg.filter((g: any) => g.teacher_id === user.id) : cg);
    setSequences(seqRes.data ?? []);

    // Get teachers list
    const { data: tch } = await supabase.from('users').select('id, full_name, email').eq('tenant_id', profile.tenant_id).in('role', ['teacher', 'site_admin', 'tenant_admin']);
    setTeachers(tch ?? []);

    setLoading(false);
  }, [supabase, weekOffset]);

  useEffect(() => { load(); }, [load]);

  // Auto-refresh every 60s
  useEffect(() => {
    const iv = setInterval(load, 60_000);
    return () => clearInterval(iv);
  }, [load]);

  function getSchedulesForSlot(classroomId: string, date: Date, hour: number) {
    const dateStr = fmt(date);
    const isoWeekday = date.getDay() === 0 ? 7 : date.getDay();

    return schedules.filter((s: any) => {
      if (s.classroom_id !== classroomId) return false;
      const sHour = parseInt(s.scheduled_time?.split(':')[0] ?? '0', 10);
      if (sHour !== hour) return false;

      switch (s.recurrence) {
        case 'once': return s.scheduled_date === dateStr;
        case 'daily': return (!s.scheduled_date || s.scheduled_date <= dateStr) && (!s.recurrence_end_date || s.recurrence_end_date >= dateStr);
        case 'weekdays': return isoWeekday >= 1 && isoWeekday <= 5 && (!s.scheduled_date || s.scheduled_date <= dateStr) && (!s.recurrence_end_date || s.recurrence_end_date >= dateStr);
        case 'weekly':
        case 'custom': return (s.recurrence_days ?? []).includes(isoWeekday) && (!s.scheduled_date || s.scheduled_date <= dateStr) && (!s.recurrence_end_date || s.recurrence_end_date >= dateStr);
        default: return false;
      }
    });
  }

  async function handleCreate() {
    if (!form.classroom_id || !form.class_group_id || !form.sequence_id || !form.scheduled_time) return;
    setSaving(true);
    setWarning('');

    const res = await fetch('/api/schedules', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        ...form,
        site_id: siteId,
        teacher_id: form.teacher_id || userId,
        scheduled_date: form.recurrence === 'once' ? form.scheduled_date : null,
      }),
    });

    if (res.ok) {
      const d = await res.json();
      if (d.warning) setWarning(d.warning);
      setCreateOpen(false);
      setForm({ ...emptyForm });
      load();
    }
    setSaving(false);
  }

  async function handleDelete(id: string) {
    await fetch(`/api/schedules/${id}`, { method: 'DELETE' });
    load();
  }

  function openCreateForSlot(classroomId: string, date: Date, hour: number) {
    setForm({
      ...emptyForm,
      classroom_id: classroomId,
      scheduled_date: fmt(date),
      scheduled_time: `${String(hour).padStart(2, '0')}:00`,
    });
    setCreateOpen(true);
  }

  if (loading) {
    return <div className="p-6"><Card><CardContent className="p-12 text-center text-muted-foreground">Loading schedule...</CardContent></Card></div>;
  }

  // Today's schedule summary for dashboard widget
  const today = new Date();
  const todayStr = fmt(today);
  const todaySchedules = schedules.filter((s: any) => {
    const isoWeekday = today.getDay() === 0 ? 7 : today.getDay();
    switch (s.recurrence) {
      case 'once': return s.scheduled_date === todayStr;
      case 'daily': return true;
      case 'weekdays': return isoWeekday >= 1 && isoWeekday <= 5;
      case 'weekly':
      case 'custom': return (s.recurrence_days ?? []).includes(isoWeekday);
      default: return false;
    }
  }).sort((a: any, b: any) => (a.scheduled_time ?? '').localeCompare(b.scheduled_time ?? ''));

  return (
    <div className="p-6 space-y-6">
      {/* Today's Schedule Summary */}
      <Card>
        <CardContent className="p-4">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold">Today&apos;s Schedule</h2>
            <Badge variant="outline">{todaySchedules.length} classes</Badge>
          </div>
          {todaySchedules.length === 0 ? (
            <p className="text-sm text-muted-foreground">No classes scheduled today</p>
          ) : (
            <div className="space-y-2">
              {todaySchedules.map((s: any) => {
                const now = new Date();
                const [h, m] = (s.scheduled_time ?? '08:00').split(':').map(Number);
                const start = new Date(now); start.setHours(h, m, 0, 0);
                const end = new Date(start); end.setMinutes(end.getMinutes() + (s.duration_minutes ?? 60));
                const isActive = now >= start && now < end;
                const isPast = now >= end;

                return (
                  <div key={s.id} className="flex items-center gap-3 p-2 rounded-lg border text-sm">
                    <Clock className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                    <span className="font-mono w-12">{s.scheduled_time?.slice(0, 5)}</span>
                    <span className="font-medium">{s.classrooms?.name ?? 'Room'}</span>
                    <span className="text-muted-foreground">·</span>
                    <span>{s.class_groups?.name ?? ''}</span>
                    <span className="text-muted-foreground">·</span>
                    <span className="text-muted-foreground truncate">{s.learning_sequences?.name ?? ''}</span>
                    <div className="ml-auto">
                      {isActive && <Badge className="bg-green-500/15 text-green-600 border-green-500/30">Active</Badge>}
                      {isPast && <Badge variant="secondary">Completed</Badge>}
                      {!isActive && !isPast && <Badge variant="outline">Scheduled</Badge>}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Weekly Calendar */}
      <Card>
        <CardContent className="p-4">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <Button variant="outline" size="icon" onClick={() => setWeekOffset(o => o - 1)}>
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <h2 className="text-lg font-semibold">
                {fmtShort(weekDates[0])} – {fmtShort(weekDates[6])}
              </h2>
              <Button variant="outline" size="icon" onClick={() => setWeekOffset(o => o + 1)}>
                <ChevronRight className="h-4 w-4" />
              </Button>
              {weekOffset !== 0 && (
                <Button variant="ghost" size="sm" onClick={() => setWeekOffset(0)}>Today</Button>
              )}
            </div>
            <Button onClick={() => { setForm({ ...emptyForm }); setCreateOpen(true); }}>
              <Plus className="h-4 w-4 mr-1" /> Schedule Class
            </Button>
          </div>

          {classrooms.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-8">No classrooms configured for this site</p>
          ) : (
            <div className="overflow-x-auto">
              {classrooms.map((room: any) => (
                <div key={room.id} className="mb-6">
                  <h3 className="text-sm font-semibold mb-2 flex items-center gap-2">
                    <Users className="h-4 w-4" /> {room.name} {room.room_code && <span className="text-muted-foreground font-normal">({room.room_code})</span>}
                  </h3>
                  <div className="grid grid-cols-8 gap-px bg-border rounded-lg overflow-hidden text-xs">
                    {/* Header row */}
                    <div className="bg-muted p-2 font-medium">Time</div>
                    {weekDates.map((d, i) => (
                      <div key={i} className={`bg-muted p-2 font-medium text-center ${fmt(d) === todayStr ? 'bg-primary/10 text-primary' : ''}`}>
                        {DAYS[i]?.slice(0, 3)}<br /><span className="text-muted-foreground">{fmtShort(d)}</span>
                      </div>
                    ))}

                    {/* Time slots */}
                    {HOURS.map(hour => (
                      <>
                        <div key={`t-${hour}`} className="bg-card p-2 font-mono text-muted-foreground border-t">
                          {String(hour).padStart(2, '0')}:00
                        </div>
                        {weekDates.map((date, di) => {
                          const slotSchedules = getSchedulesForSlot(room.id, date, hour);
                          return (
                            <div
                              key={`${hour}-${di}`}
                              className="bg-card p-1 border-t min-h-[48px] cursor-pointer hover:bg-muted/50 transition-colors"
                              onClick={() => slotSchedules.length === 0 ? openCreateForSlot(room.id, date, hour) : undefined}
                            >
                              {slotSchedules.map((s: any) => (
                                <div
                                  key={s.id}
                                  className="bg-primary/10 border border-primary/30 rounded p-1 mb-1 text-[10px] leading-tight group relative"
                                >
                                  <div className="font-medium truncate">{s.class_groups?.name ?? ''}</div>
                                  <div className="text-muted-foreground truncate">{s.learning_sequences?.name ?? ''}</div>
                                  <div className="text-muted-foreground">{s.duration_minutes}min</div>
                                  <button
                                    className="absolute top-0.5 right-0.5 opacity-0 group-hover:opacity-100 transition-opacity p-0.5 rounded hover:bg-destructive/20"
                                    onClick={(e) => { e.stopPropagation(); handleDelete(s.id); }}
                                  >
                                    <Trash2 className="h-3 w-3 text-destructive" />
                                  </button>
                                </div>
                              ))}
                            </div>
                          );
                        })}
                      </>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Create/Edit Schedule Dialog */}
      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Schedule a Class</DialogTitle>
            <DialogDescription>Assign a learning sequence to a classroom time slot.</DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div>
              <Label>Classroom</Label>
              <Select value={form.classroom_id} onValueChange={v => setForm(f => ({ ...f, classroom_id: v }))}>
                <SelectTrigger><SelectValue placeholder="Select classroom" /></SelectTrigger>
                <SelectContent>
                  {classrooms.map((r: any) => (
                    <SelectItem key={r.id} value={r.id}>{r.name} {r.room_code ? `(${r.room_code})` : ''}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label>Class Group</Label>
              <Select value={form.class_group_id} onValueChange={v => setForm(f => ({ ...f, class_group_id: v }))}>
                <SelectTrigger><SelectValue placeholder="Select class group" /></SelectTrigger>
                <SelectContent>
                  {classGroups.map((g: any) => (
                    <SelectItem key={g.id} value={g.id}>
                      {g.name} {g.grades?.name ? `· ${g.grades.name}` : ''} {g.subjects?.name ? `· ${g.subjects.name}` : ''}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label>Sequence</Label>
              <Select value={form.sequence_id} onValueChange={v => setForm(f => ({ ...f, sequence_id: v }))}>
                <SelectTrigger><SelectValue placeholder="Select sequence" /></SelectTrigger>
                <SelectContent>
                  {sequences.map((s: any) => (
                    <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {userRole !== 'teacher' && (
              <div>
                <Label>Teacher</Label>
                <Select value={form.teacher_id} onValueChange={v => setForm(f => ({ ...f, teacher_id: v }))}>
                  <SelectTrigger><SelectValue placeholder="Select teacher" /></SelectTrigger>
                  <SelectContent>
                    {teachers.map((t: any) => (
                      <SelectItem key={t.id} value={t.id}>{t.full_name ?? t.email}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Time</Label>
                <Input
                  type="time"
                  value={form.scheduled_time}
                  onChange={e => setForm(f => ({ ...f, scheduled_time: e.target.value }))}
                />
              </div>
              <div>
                <Label>Duration</Label>
                <Select value={String(form.duration_minutes)} onValueChange={v => setForm(f => ({ ...f, duration_minutes: parseInt(v) }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {DURATION_OPTIONS.map(d => (
                      <SelectItem key={d} value={String(d)}>{d} min</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div>
              <Label>Recurrence</Label>
              <Select value={form.recurrence} onValueChange={v => setForm(f => ({ ...f, recurrence: v }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {RECURRENCE_OPTIONS.map(r => (
                    <SelectItem key={r.value} value={r.value}>{r.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {form.recurrence === 'once' && (
              <div>
                <Label>Date</Label>
                <Input
                  type="date"
                  value={form.scheduled_date}
                  onChange={e => setForm(f => ({ ...f, scheduled_date: e.target.value }))}
                />
              </div>
            )}

            {(form.recurrence === 'weekly' || form.recurrence === 'custom') && (
              <div>
                <Label>Days</Label>
                <div className="flex gap-1 mt-1">
                  {DAYS.map((day, i) => {
                    const isoDay = i + 1;
                    const selected = form.recurrence_days.includes(isoDay);
                    return (
                      <Button
                        key={day}
                        variant={selected ? 'default' : 'outline'}
                        size="sm"
                        className="w-10 h-8 text-xs"
                        onClick={() => setForm(f => ({
                          ...f,
                          recurrence_days: selected
                            ? f.recurrence_days.filter(d => d !== isoDay)
                            : [...f.recurrence_days, isoDay],
                        }))}
                      >
                        {day.slice(0, 2)}
                      </Button>
                    );
                  })}
                </div>
              </div>
            )}

            {form.recurrence !== 'once' && (
              <div>
                <Label>End date (optional)</Label>
                <Input
                  type="date"
                  value={form.recurrence_end_date}
                  onChange={e => setForm(f => ({ ...f, recurrence_end_date: e.target.value }))}
                />
              </div>
            )}

            <div>
              <Label>Notes (optional)</Label>
              <Input
                value={form.notes}
                onChange={e => setForm(f => ({ ...f, notes: e.target.value }))}
                placeholder="E.g. Lab session, bring materials"
              />
            </div>

            {warning && (
              <div className="bg-yellow-500/10 border border-yellow-500/30 rounded-lg p-3 text-sm text-yellow-600">
                {warning}
              </div>
            )}
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setCreateOpen(false)}>Cancel</Button>
            <Button onClick={handleCreate} disabled={saving || !form.classroom_id || !form.class_group_id || !form.sequence_id}>
              {saving ? 'Saving...' : 'Schedule'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
