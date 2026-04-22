/**
 * Endpoint catalog for the API Test page.
 *
 * Each entry declares the minimum role needed to call the route in a way
 * that normally succeeds. The handler still enforces its own auth — this
 * list just filters the UI so testers see endpoints relevant to their role.
 *
 * Node-only endpoints (heartbeat, register, node-jobs) are intentionally
 * excluded — those require an X-Node-Token and aren't useful for in-browser
 * testing. Cron endpoints are excluded for the same reason (CRON_SECRET).
 */

export type Role =
  | 'super_admin'
  | 'tenant_admin'
  | 'site_admin'
  | 'content_manager'
  | 'teacher'
  | 'student';

export interface Endpoint {
  method: 'GET' | 'POST' | 'PATCH' | 'DELETE';
  path: string;
  description: string;
  minRole: Role;
  sampleBody?: Record<string, unknown>;
  group: 'Content' | 'Curriculum' | 'Classrooms' | 'Schedules' | 'Users' | 'Devices' | 'Alerts' | 'Reports' | 'Quiz' | 'Other';
}

const R: Record<Role, number> = {
  student: 1,
  teacher: 2,
  content_manager: 3,
  site_admin: 4,
  tenant_admin: 5,
  super_admin: 6,
};

export function roleRank(role: Role): number {
  return R[role] ?? 0;
}

export function endpointsForRole(role: Role): Endpoint[] {
  const rank = roleRank(role);
  return CATALOG.filter((e) => rank >= roleRank(e.minRole));
}

export const CATALOG: Endpoint[] = [
  // ── Content & Assets ────────────────────────────────────────────
  {
    method: 'GET',
    path: '/api/assets/{assetId}/download-url',
    description: 'Get a signed download URL for an asset (requires X-Node-Token — for manual test only)',
    minRole: 'content_manager',
    group: 'Content',
  },

  // ── Curriculum ──────────────────────────────────────────────────
  {
    method: 'GET',
    path: '/api/curriculum',
    description: 'List grades, subjects, terms',
    minRole: 'teacher',
    group: 'Curriculum',
  },
  {
    method: 'GET',
    path: '/api/curriculum/sequences',
    description: 'List learning sequences visible to the caller',
    minRole: 'teacher',
    group: 'Curriculum',
  },
  {
    method: 'GET',
    path: '/api/curriculum/sequences/{sequenceId}',
    description: 'Fetch a sequence with items',
    minRole: 'student',
    group: 'Curriculum',
  },

  // ── Classrooms ──────────────────────────────────────────────────
  {
    method: 'GET',
    path: '/api/classrooms',
    description: 'List classrooms in scope',
    minRole: 'teacher',
    group: 'Classrooms',
  },
  {
    method: 'GET',
    path: '/api/classrooms/{id}',
    description: 'Fetch a single classroom',
    minRole: 'teacher',
    group: 'Classrooms',
  },
  {
    method: 'POST',
    path: '/api/classrooms/{id}/enrollment-codes',
    description: 'Create a new device enrollment code for a classroom',
    minRole: 'site_admin',
    sampleBody: { expires_in_hours: 24 },
    group: 'Classrooms',
  },

  // ── Schedules ───────────────────────────────────────────────────
  {
    method: 'GET',
    path: '/api/schedules',
    description: 'List classroom schedules',
    minRole: 'teacher',
    group: 'Schedules',
  },
  {
    method: 'POST',
    path: '/api/schedules',
    description: 'Create a schedule',
    minRole: 'teacher',
    sampleBody: {
      classroom_id: '',
      class_group_id: '',
      sequence_id: '',
      scheduled_time: '09:00',
      duration_minutes: 45,
      recurrence: 'once',
    },
    group: 'Schedules',
  },
  {
    method: 'GET',
    path: '/api/schedules/classroom/{classroomId}/today',
    description: "Today's schedule for a classroom",
    minRole: 'teacher',
    group: 'Schedules',
  },
  {
    method: 'GET',
    path: '/api/schedules/{scheduleId}/readiness',
    description: 'Is the node ready to serve this scheduled lesson?',
    minRole: 'teacher',
    group: 'Schedules',
  },
  {
    method: 'DELETE',
    path: '/api/schedules/{scheduleId}',
    description: 'Cancel a schedule',
    minRole: 'teacher',
    group: 'Schedules',
  },

  // ── Quiz ────────────────────────────────────────────────────────
  {
    method: 'GET',
    path: '/api/quiz/{quizId}',
    description: 'Fetch quiz with questions',
    minRole: 'student',
    group: 'Quiz',
  },
  {
    method: 'POST',
    path: '/api/quiz',
    description: 'Create a quiz definition',
    minRole: 'content_manager',
    sampleBody: { title: 'Sample', time_limit_minutes: 5, questions: [] },
    group: 'Quiz',
  },
  {
    method: 'POST',
    path: '/api/progress',
    description: 'Upload progress records / quiz attempts (node-facing)',
    minRole: 'teacher',
    sampleBody: { progress_records: [], quiz_attempts: [] },
    group: 'Quiz',
  },

  // ── Devices ─────────────────────────────────────────────────────
  {
    method: 'GET',
    path: '/api/devices/validate-token',
    description: 'Check whether an enrollment token is still valid',
    minRole: 'site_admin',
    group: 'Devices',
  },
  {
    method: 'GET',
    path: '/api/devices/{id}',
    description: 'Fetch a device',
    minRole: 'site_admin',
    group: 'Devices',
  },
  {
    method: 'POST',
    path: '/api/devices/{id}/revoke',
    description: 'Revoke a device',
    minRole: 'site_admin',
    group: 'Devices',
  },
  {
    method: 'POST',
    path: '/api/devices/{id}/rotate-token',
    description: 'Rotate a device enrollment token',
    minRole: 'site_admin',
    group: 'Devices',
  },

  // ── Users ───────────────────────────────────────────────────────
  {
    method: 'POST',
    path: '/api/users/invite',
    description: 'Invite a new user to the tenant',
    minRole: 'tenant_admin',
    sampleBody: { email: 'new.user@example.com', role: 'teacher' },
    group: 'Users',
  },

  // ── Alerts ──────────────────────────────────────────────────────
  {
    method: 'GET',
    path: '/api/alerts/subscriptions',
    description: 'List the current user\'s alert subscriptions',
    minRole: 'tenant_admin',
    group: 'Alerts',
  },
  {
    method: 'POST',
    path: '/api/alerts/subscriptions',
    description: 'Subscribe to an alert type',
    minRole: 'tenant_admin',
    sampleBody: { alert_type: 'node_offline', channels: ['email'] },
    group: 'Alerts',
  },

  // ── Reports ─────────────────────────────────────────────────────
  {
    method: 'GET',
    path: '/api/reports?type=quiz_results&format=csv',
    description: 'Export quiz results CSV',
    minRole: 'teacher',
    group: 'Reports',
  },

  // ── Other / sync / bulk ─────────────────────────────────────────
  {
    method: 'POST',
    path: '/api/sync/enqueue',
    description: 'Enqueue a package sync job',
    minRole: 'content_manager',
    sampleBody: { package_id: '' },
    group: 'Other',
  },
  {
    method: 'POST',
    path: '/api/bulk',
    description: 'Bulk operations (admin-only)',
    minRole: 'tenant_admin',
    sampleBody: { action: '', ids: [] },
    group: 'Other',
  },
  {
    method: 'GET',
    path: '/api/health',
    description: 'Service health',
    minRole: 'student',
    group: 'Other',
  },
  {
    method: 'GET',
    path: '/api/notifications',
    description: 'List notifications for current user',
    minRole: 'student',
    group: 'Other',
  },
  {
    method: 'POST',
    path: '/api/quick-lesson',
    description: 'Schedule a one-off lesson (wraps package + schedule creation)',
    minRole: 'teacher',
    sampleBody: {
      asset_id: '',
      title: '',
      class_group_id: '',
      classroom_id: '',
      scheduled_time: '09:00',
    },
    group: 'Schedules',
  },
];
