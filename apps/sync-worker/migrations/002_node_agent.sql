-- ============================================================
-- Node Agent Local Tables
-- ============================================================

CREATE TABLE IF NOT EXISTS enrolled_devices (
  device_id           text PRIMARY KEY,
  classroom_id        text NOT NULL,
  enrollment_token    text UNIQUE,
  local_session_token text UNIQUE NOT NULL,
  device_name         text,
  device_type         text DEFAULT 'browser',
  status              text NOT NULL DEFAULT 'enrolled',
  enrolled_at         timestamptz DEFAULT now(),
  last_seen_at        timestamptz,
  ip_address          text
);

CREATE TABLE IF NOT EXISTS classroom_cache (
  classroom_id  text PRIMARY KEY,
  node_id       text,
  name          text NOT NULL,
  room_code     text,
  cached_at     timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS local_playback_sessions (
  id                text PRIMARY KEY,
  device_id         text,
  asset_id          text NOT NULL,
  started_at        timestamptz DEFAULT now(),
  ended_at          timestamptz,
  duration_seconds  int,
  status            text DEFAULT 'active',
  synced_to_cloud   boolean DEFAULT false
);
