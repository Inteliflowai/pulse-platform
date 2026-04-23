-- ============================================================
-- 014: Add duration_seconds to assets
--
-- Captured at upload time (browser reads video metadata via a hidden
-- <video> element before the file goes to Supabase Storage). Used by
-- GET /api/videos so CORE's lesson editor can show video length in the
-- video-picker dropdown. Null is fine — old rows, non-video assets, or
-- videos whose metadata failed to load will simply render without a
-- duration.
-- ============================================================

ALTER TABLE assets ADD COLUMN duration_seconds numeric;
