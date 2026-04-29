-- ============================================================
-- 015: Add delivery_mode to classrooms
--
-- Tells Pulse whether a classroom uses personal devices (laptops/tablets,
-- one student per device) or a shared STB/TV at the front of the room.
-- Drives the CORE three-mode handoff on lesson-complete:
--   pulse_local + student_id → CORE 'individual' mode (signed JWT URL)
--   pulse_stb (no student_id) → CORE 'class_fanout' mode (quiz to all students)
--
-- Until now this column lived only in node-agent SQLite (db.ts:36) with
-- default 'pulse_local'. Cloud had no way to set it, so shared-STB classrooms
-- could never signal their mode to CORE. Audit 2026-04-28 §3 hotspot #1.
--
-- Pushed to nodes via /api/nodes/[nodeId]/config (existing select('*') on
-- classrooms picks it up automatically). Node-side syncSchedulesFromCloud
-- writes it into classroom_cache.
-- ============================================================

ALTER TABLE classrooms
  ADD COLUMN delivery_mode text NOT NULL DEFAULT 'pulse_local'
  CHECK (delivery_mode IN ('pulse_local', 'pulse_stb'));
