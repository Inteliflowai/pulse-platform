-- ============================================================
-- Pulse Seed Data
-- Run this AFTER creating an Auth user in the Supabase dashboard.
-- Replace YOUR_AUTH_USER_UUID and YOUR_EMAIL below.
-- ============================================================

-- 1. Tenant
INSERT INTO tenants (id, name, slug)
VALUES ('a0000000-0000-0000-0000-000000000001', 'Inteliflow', 'inteliflow')
ON CONFLICT (slug) DO NOTHING;

-- 2. Site
INSERT INTO sites (id, tenant_id, name, slug, timezone)
VALUES ('b0000000-0000-0000-0000-000000000001', 'a0000000-0000-0000-0000-000000000001', 'HQ', 'hq', 'Africa/Johannesburg')
ON CONFLICT DO NOTHING;

-- 3. Super Admin user (matches auth.users)
-- >>> REPLACE these two values <<<
INSERT INTO users (id, tenant_id, email, full_name, role)
VALUES (
  '00000000-0000-0000-0000-000000000000',  -- ← paste your Auth user UUID here
  'a0000000-0000-0000-0000-000000000001',
  'admin@inteliflow.com',                   -- ← your email
  'Admin',
  'super_admin'
)
ON CONFLICT (email) DO NOTHING;
