-- ============================================================
-- 012: CORE class_id mapping on class_groups
--
-- CORE's classes.id is a distinct identity from Pulse's class_groups.id.
-- When Pulse imports classes from CORE, CORE returns a core_class_id per
-- class. Pulse stores it as a first-class column so:
--   (a) lesson-complete events can include core_class_id, letting CORE
--       route "which class watched this video?" without re-resolving the
--       Pulse classroom_id on every request.
--   (b) Future CORE→Pulse callbacks (e.g. "quiz published to class") can
--       target a class by its CORE identity.
--
-- Nullable because tenants may have class_groups authored directly in
-- Pulse that have never been synced to CORE.
-- ============================================================

ALTER TABLE class_groups
  ADD COLUMN IF NOT EXISTS core_class_id text;

CREATE INDEX IF NOT EXISTS idx_class_groups_core_class_id
  ON class_groups(core_class_id)
  WHERE core_class_id IS NOT NULL;
