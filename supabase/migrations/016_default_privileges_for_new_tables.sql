-- ============================================================
-- 016_default_privileges_for_new_tables.sql
-- Default privileges for tables in public schema
-- ============================================================
--
-- Supabase platform change (rollout Oct 30, 2026 for existing
-- projects): new tables created in the 'public' schema no longer
-- auto-grant access to anon/authenticated/service_role. Without
-- this, every future CREATE TABLE in public is invisible to
-- supabase-js and returns 42501 on access.
--
-- This migration restores the pre-Oct-30 behavior LOCALLY on this
-- database by setting ALTER DEFAULT PRIVILEGES so any future table,
-- sequence, or function created in this schema auto-receives grants
-- for the three Supabase roles.
--
-- Existing tables are unaffected — their current grants are
-- preserved per Supabase's notification. Every existing table in
-- Pulse already has RLS enabled (audited 2026-05-13: 1:1 ratio of
-- ENABLE ROW LEVEL SECURITY to CREATE TABLE across all migrations);
-- this directive does not weaken that posture.
--
-- Note on scope: ALTER DEFAULT PRIVILEGES applies to objects
-- created by the role that issues the command. Supabase migrations
-- run as the `postgres` role, so the directive covers future
-- `postgres`-issued CREATE TABLE statements. Tables created by a
-- non-postgres role (uncommon) won't auto-inherit; those will
-- still need explicit GRANTs.
-- ============================================================

ALTER DEFAULT PRIVILEGES IN SCHEMA public
  GRANT ALL ON TABLES TO anon, authenticated, service_role;

ALTER DEFAULT PRIVILEGES IN SCHEMA public
  GRANT ALL ON SEQUENCES TO anon, authenticated, service_role;

ALTER DEFAULT PRIVILEGES IN SCHEMA public
  GRANT EXECUTE ON FUNCTIONS TO anon, authenticated, service_role;
