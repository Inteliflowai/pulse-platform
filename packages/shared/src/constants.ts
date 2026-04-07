export const API_VERSION = 'v1';

export const HEARTBEAT_INTERVAL_MS = 60_000;

export const SYNC_RETRY_MAX = 5;

export const ENROLLMENT_TOKEN_TTL_HOURS = 48;

export const DEFAULT_ROLES: Record<string, string> = {
  super_admin: 'Super Admin',
  tenant_admin: 'Tenant Admin',
  site_admin: 'Site Admin',
  content_manager: 'Content Manager',
  teacher: 'Teacher',
  student: 'Student',
};
