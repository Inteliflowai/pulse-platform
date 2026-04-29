// ============================================================
// Pulse Shared Types
// ============================================================

// --- Enums ---

export enum NodeStatus {
  Pending = 'pending',
  Active = 'active',
  Offline = 'offline',
  Decommissioned = 'decommissioned',
}

export enum DeviceStatus {
  Pending = 'pending',
  Enrolled = 'enrolled',
  Revoked = 'revoked',
}

export enum SyncJobStatus {
  Pending = 'pending',
  InProgress = 'in_progress',
  Completed = 'completed',
  Failed = 'failed',
  Cancelled = 'cancelled',
}

export enum AssetStatus {
  Pending = 'pending',
  Processing = 'processing',
  Ready = 'ready',
  Error = 'error',
  Deprecated = 'deprecated',
}

export enum PackageStatus {
  Draft = 'draft',
  Published = 'published',
  Deprecated = 'deprecated',
}

// --- Table Interfaces ---

export interface Tenant {
  id: string;
  name: string;
  slug: string;
  status: string;
  metadata: Record<string, unknown>;
  created_at: string;
  updated_at: string;
}

export interface Site {
  id: string;
  tenant_id: string;
  name: string;
  slug: string;
  address: string | null;
  timezone: string | null;
  status: string;
  metadata: Record<string, unknown>;
  created_at: string;
  updated_at: string;
}

export interface Node {
  id: string;
  site_id: string;
  tenant_id: string;
  name: string;
  hostname: string | null;
  status: NodeStatus;
  version: string | null;
  last_seen_at: string | null;
  storage_total_gb: number | null;
  storage_used_gb: number | null;
  ip_address: string | null;
  registration_token: string | null;
  registered_at: string | null;
  metadata: Record<string, unknown>;
  created_at: string;
  updated_at: string;
}

export interface User {
  id: string;
  tenant_id: string;
  site_id: string | null;
  email: string;
  full_name: string | null;
  role: 'super_admin' | 'tenant_admin' | 'site_admin' | 'content_manager' | 'teacher' | 'student';
  status: string;
  metadata: Record<string, unknown>;
  created_at: string;
  updated_at: string;
}

export interface Classroom {
  id: string;
  site_id: string;
  node_id: string | null;
  name: string;
  room_code: string | null;
  capacity: number | null;
  status: string;
  metadata: Record<string, unknown>;
  created_at: string;
  updated_at: string;
}

export interface Device {
  id: string;
  classroom_id: string | null;
  node_id: string;
  tenant_id: string;
  name: string;
  device_type: 'browser' | 'stb' | 'tv' | 'tablet' | 'laptop' | 'other';
  enrollment_token: string | null;
  status: DeviceStatus;
  last_seen_at: string | null;
  ip_address: string | null;
  metadata: Record<string, unknown>;
  created_at: string;
  updated_at: string;
}

export interface Asset {
  id: string;
  tenant_id: string;
  uploaded_by: string | null;
  filename: string;
  original_filename: string | null;
  mime_type: string | null;
  size_bytes: number | null;
  checksum: string | null;
  storage_path: string | null;
  jellyfin_item_id: string | null;
  status: AssetStatus;
  duration_seconds: number | null;
  metadata: Record<string, unknown>;
  created_at: string;
  updated_at: string;
}

export interface Package {
  id: string;
  tenant_id: string;
  created_by: string | null;
  name: string;
  description: string | null;
  version: string;
  status: PackageStatus;
  manifest: PackageManifest | null;
  target_sites: string[];
  total_size_bytes: number;
  metadata: Record<string, unknown>;
  created_at: string;
  updated_at: string;
}

export interface PackageAsset {
  id: string;
  package_id: string;
  asset_id: string;
  sort_order: number;
  created_at: string;
}

export interface SyncJob {
  id: string;
  package_id: string;
  node_id: string;
  status: SyncJobStatus;
  progress_pct: number;
  bytes_transferred: number;
  bytes_total: number;
  retries: number;
  error_message: string | null;
  started_at: string | null;
  completed_at: string | null;
  metadata: Record<string, unknown>;
  created_at: string;
  updated_at: string;
}

export interface PlaybackSession {
  id: string;
  node_id: string;
  device_id: string | null;
  asset_id: string;
  user_id: string | null;
  started_at: string;
  ended_at: string | null;
  duration_seconds: number | null;
  status: 'active' | 'completed' | 'interrupted';
  metadata: Record<string, unknown>;
  created_at: string;
}

export interface AuditLog {
  id: string;
  tenant_id: string;
  user_id: string | null;
  node_id: string | null;
  event_type: string;
  entity_type: string | null;
  entity_id: string | null;
  description: string | null;
  ip_address: string | null;
  metadata: Record<string, unknown>;
  created_at: string;
}

export interface NodeEvent {
  id: string;
  node_id: string;
  event_type: string;
  severity: 'info' | 'warning' | 'error' | 'critical';
  message: string | null;
  metadata: Record<string, unknown>;
  created_at: string;
}

export interface SoftwareRelease {
  id: string;
  version: string;
  release_notes: string | null;
  download_url: string | null;
  checksum: string | null;
  status: 'draft' | 'staged' | 'released' | 'deprecated';
  released_at: string | null;
  metadata: Record<string, unknown>;
  created_at: string;
  updated_at: string;
}

export interface ClassroomSchedule {
  id: string;
  classroom_id: string;
  class_group_id: string;
  sequence_id: string;
  teacher_id: string | null;
  site_id: string;
  tenant_id: string;
  scheduled_date: string | null;
  scheduled_time: string;
  duration_minutes: number;
  recurrence: 'once' | 'daily' | 'weekly' | 'weekdays' | 'custom';
  recurrence_days: number[];
  recurrence_end_date: string | null;
  status: 'scheduled' | 'active' | 'completed' | 'cancelled';
  started_at: string | null;
  ended_at: string | null;
  notes: string | null;
  metadata: Record<string, unknown> | null;
  created_at: string;
  updated_at: string;
}

export enum ScheduleStatus {
  Scheduled = 'scheduled',
  Active = 'active',
  Completed = 'completed',
  Cancelled = 'cancelled',
}

export enum ScheduleRecurrence {
  Once = 'once',
  Daily = 'daily',
  Weekly = 'weekly',
  Weekdays = 'weekdays',
  Custom = 'custom',
}

// --- Domain Types ---

export interface PackageManifest {
  version: string;
  assets: {
    asset_id: string;
    filename: string;
    size_bytes: number;
    checksum: string;
    jellyfin_item_id?: string;
  }[];
  created_at: string;
  publisher: string;
}

export interface HeartbeatPayload {
  node_id: string;
  timestamp: string;
  version: string;
  storage_used_gb: number;
  storage_total_gb: number;
  active_sessions: number;
  jellyfin_reachable: boolean;
  wan_connected: boolean;
  cpu_usage_pct: number;
  memory_used_gb: number;
  memory_total_gb: number;
  enrolled_devices: number;
  pending_sync_jobs: number;
  completed_sync_jobs_today: number;
  failed_sync_jobs_today: number;
  uptime_seconds: number;
  jellyfin_version: string | null;
  last_successful_sync_at: string | null;
  metadata?: Record<string, unknown>;
}

export interface NodeMetric {
  id: string;
  node_id: string;
  recorded_at: string;
  cpu_pct: number | null;
  memory_used_gb: number | null;
  memory_total_gb: number | null;
  storage_used_gb: number | null;
  storage_total_gb: number | null;
  active_sessions: number;
  enrolled_devices: number;
  pending_sync_jobs: number;
  wan_connected: boolean;
  jellyfin_reachable: boolean;
}

export interface SoftwareUpdateAssignment {
  id: string;
  release_id: string;
  node_id: string;
  status: 'pending' | 'downloading' | 'applying' | 'completed' | 'failed' | 'rolled_back';
  assigned_at: string;
  completed_at: string | null;
  error: string | null;
  created_at: string;
  updated_at: string;
}
