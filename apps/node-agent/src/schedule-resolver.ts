/**
 * Schedule Resolver — determines what should be playing in a classroom right now.
 *
 * Reads from the local SQLite classroom_schedule_cache (synced from cloud).
 * Handles one-time, daily, weekly, weekday, and custom recurrence patterns.
 */

import { getSchedulesForClassroom } from './db';

export interface ActiveSchedule {
  schedule_id: string;
  classroom_id: string;
  class_group_id: string;
  sequence_id: string;
  teacher_id: string | null;
  teacher_name: string | null;
  class_group_name: string;
  sequence_name: string;
  started_at: string;
  ends_at: string;
  minutes_remaining: number;
}

/**
 * Get the ISO weekday (1=Monday ... 7=Sunday) for a Date.
 */
function isoWeekday(d: Date): number {
  const day = d.getDay(); // 0=Sunday
  return day === 0 ? 7 : day;
}

/**
 * Parse a "HH:MM" or "HH:MM:SS" time string to total minutes since midnight.
 */
function timeToMinutes(timeStr: string): number {
  const parts = timeStr.split(':');
  return parseInt(parts[0], 10) * 60 + parseInt(parts[1] ?? '0', 10);
}

/**
 * Format a Date as "YYYY-MM-DD".
 */
function dateStr(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

/**
 * Get the currently active schedule for a classroom.
 * Returns null if no class is scheduled right now.
 */
export function getActiveSchedule(classroomId: string, at?: Date): ActiveSchedule | null {
  const now = at ?? new Date();
  const today = dateStr(now);
  const todayWeekday = isoWeekday(now);
  const currentMinutes = now.getHours() * 60 + now.getMinutes();

  const schedules = getSchedulesForClassroom(classroomId) as any[];
  const matches: (ActiveSchedule | null)[] = [];

  for (const s of schedules) {
    if (s.status === 'cancelled') continue;

    const scheduleMinutes = timeToMinutes(s.scheduled_time);
    const endMinutes = scheduleMinutes + (s.duration_minutes ?? 60);

    // Check if current time falls within the schedule window
    if (currentMinutes < scheduleMinutes || currentMinutes >= endMinutes) continue;

    // Check date/recurrence match
    if (!matchesDate(s, today, todayWeekday)) continue;

    const startDate = new Date(now);
    startDate.setHours(Math.floor(scheduleMinutes / 60), scheduleMinutes % 60, 0, 0);
    const endDate = new Date(now);
    endDate.setHours(Math.floor(endMinutes / 60), endMinutes % 60, 0, 0);

    matches.push({
      schedule_id: s.id,
      classroom_id: s.classroom_id,
      class_group_id: s.class_group_id,
      sequence_id: s.sequence_id,
      teacher_id: s.teacher_id ?? null,
      teacher_name: s.teacher_name ?? null,
      class_group_name: s.class_group_name ?? '',
      sequence_name: s.sequence_name ?? '',
      started_at: startDate.toISOString(),
      ends_at: endDate.toISOString(),
      minutes_remaining: endMinutes - currentMinutes,
    });
  }

  if (matches.length === 0) return null;

  // If multiple match (scheduling conflict), return earliest start time
  matches.sort((a, b) => {
    if (!a || !b) return 0;
    return timeToMinutes(a.started_at.slice(11, 16)) - timeToMinutes(b.started_at.slice(11, 16));
  });

  return matches[0] ?? null;
}

/**
 * Get the next upcoming schedule within `withinMinutes` minutes.
 */
export function getUpcomingSchedule(classroomId: string, withinMinutes: number = 15, at?: Date): ActiveSchedule | null {
  const now = at ?? new Date();
  const today = dateStr(now);
  const todayWeekday = isoWeekday(now);
  const currentMinutes = now.getHours() * 60 + now.getMinutes();
  const windowEnd = currentMinutes + withinMinutes;

  const schedules = getSchedulesForClassroom(classroomId) as any[];
  let best: ActiveSchedule | null = null;
  let bestStart = Infinity;

  for (const s of schedules) {
    if (s.status === 'cancelled') continue;

    const scheduleMinutes = timeToMinutes(s.scheduled_time);

    // Must be in the future but within the window
    if (scheduleMinutes <= currentMinutes || scheduleMinutes > windowEnd) continue;

    if (!matchesDate(s, today, todayWeekday)) continue;

    if (scheduleMinutes < bestStart) {
      bestStart = scheduleMinutes;
      const endMinutes = scheduleMinutes + (s.duration_minutes ?? 60);
      const startDate = new Date(now);
      startDate.setHours(Math.floor(scheduleMinutes / 60), scheduleMinutes % 60, 0, 0);
      const endDate = new Date(now);
      endDate.setHours(Math.floor(endMinutes / 60), endMinutes % 60, 0, 0);

      best = {
        schedule_id: s.id,
        classroom_id: s.classroom_id,
        class_group_id: s.class_group_id,
        sequence_id: s.sequence_id,
        teacher_id: s.teacher_id ?? null,
        teacher_name: s.teacher_name ?? null,
        class_group_name: s.class_group_name ?? '',
        sequence_name: s.sequence_name ?? '',
        started_at: startDate.toISOString(),
        ends_at: endDate.toISOString(),
        minutes_remaining: scheduleMinutes - currentMinutes,
      };
    }
  }

  return best;
}

/**
 * Get all schedules for a classroom on a given day.
 */
export function getAllSchedulesForClassroom(classroomId: string, date: Date): ActiveSchedule[] {
  const day = dateStr(date);
  const dayWeekday = isoWeekday(date);

  const schedules = getSchedulesForClassroom(classroomId) as any[];
  const results: ActiveSchedule[] = [];

  for (const s of schedules) {
    if (s.status === 'cancelled') continue;
    if (!matchesDate(s, day, dayWeekday)) continue;

    const scheduleMinutes = timeToMinutes(s.scheduled_time);
    const endMinutes = scheduleMinutes + (s.duration_minutes ?? 60);
    const startDate = new Date(date);
    startDate.setHours(Math.floor(scheduleMinutes / 60), scheduleMinutes % 60, 0, 0);
    const endDate = new Date(date);
    endDate.setHours(Math.floor(endMinutes / 60), endMinutes % 60, 0, 0);

    results.push({
      schedule_id: s.id,
      classroom_id: s.classroom_id,
      class_group_id: s.class_group_id,
      sequence_id: s.sequence_id,
      teacher_id: s.teacher_id ?? null,
      teacher_name: s.teacher_name ?? null,
      class_group_name: s.class_group_name ?? '',
      sequence_name: s.sequence_name ?? '',
      started_at: startDate.toISOString(),
      ends_at: endDate.toISOString(),
      minutes_remaining: endMinutes - scheduleMinutes,
    });
  }

  results.sort((a, b) => timeToMinutes(a.started_at.slice(11, 16)) - timeToMinutes(b.started_at.slice(11, 16)));
  return results;
}

/**
 * Check if a schedule matches a given date based on its recurrence pattern.
 */
function matchesDate(schedule: any, today: string, todayWeekday: number): boolean {
  const recurrence: string = schedule.recurrence ?? 'once';

  // Check recurrence end date
  if (schedule.recurrence_end_date && schedule.recurrence_end_date < today) {
    return false;
  }

  switch (recurrence) {
    case 'once':
      return schedule.scheduled_date === today;

    case 'daily':
      // If scheduled_date is set, only match on or after that date
      if (schedule.scheduled_date && schedule.scheduled_date > today) return false;
      return true;

    case 'weekdays':
      if (schedule.scheduled_date && schedule.scheduled_date > today) return false;
      return todayWeekday >= 1 && todayWeekday <= 5;

    case 'weekly': {
      if (schedule.scheduled_date && schedule.scheduled_date > today) return false;
      const days = parseDays(schedule.recurrence_days);
      return days.includes(todayWeekday);
    }

    case 'custom': {
      if (schedule.scheduled_date && schedule.scheduled_date > today) return false;
      const customDays = parseDays(schedule.recurrence_days);
      return customDays.includes(todayWeekday);
    }

    default:
      return false;
  }
}

function parseDays(raw: any): number[] {
  if (Array.isArray(raw)) return raw;
  if (typeof raw === 'string') {
    try { return JSON.parse(raw); } catch { return []; }
  }
  return [];
}
