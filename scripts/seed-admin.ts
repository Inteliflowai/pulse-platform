/**
 * Seed script: creates a Supabase Auth user + tenant + site + users row.
 *
 * Usage:
 *   npx tsx scripts/seed-admin.ts
 *
 * Reads from .env in the project root.
 */

import { createClient } from '@supabase/supabase-js';
import { config } from 'dotenv';
import { resolve } from 'path';

config({ path: resolve(__dirname, '../.env') });

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!;

// ── Customize these ─────────────────────────────────────────
const ADMIN_EMAIL = 'admin@inteliflow.com';
const ADMIN_PASSWORD = 'PulseAdmin123!';
const ADMIN_NAME = 'Pulse Admin';
const TENANT_NAME = 'Inteliflow';
const SITE_NAME = 'HQ';
// ─────────────────────────────────────────────────────────────

async function main() {
  if (!SUPABASE_URL || !SERVICE_ROLE_KEY) {
    console.error('Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env');
    process.exit(1);
  }

  const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  console.log('Creating auth user...');
  const { data: authData, error: authError } = await supabase.auth.admin.createUser({
    email: ADMIN_EMAIL,
    password: ADMIN_PASSWORD,
    email_confirm: true,
  });

  if (authError) {
    if (authError.message.includes('already been registered')) {
      console.log('Auth user already exists, fetching...');
      const { data: { users } } = await supabase.auth.admin.listUsers();
      const existing = users.find((u) => u.email === ADMIN_EMAIL);
      if (!existing) { console.error('Could not find existing user'); process.exit(1); }
      await seedDatabase(supabase, existing.id);
    } else {
      console.error('Auth error:', authError.message);
      process.exit(1);
    }
  } else {
    await seedDatabase(supabase, authData.user.id);
  }
}

async function seedDatabase(supabase: any, userId: string) {
  console.log(`Auth user ID: ${userId}`);

  // Tenant
  console.log('Creating tenant...');
  const { data: tenant, error: tenantErr } = await supabase
    .from('tenants')
    .upsert({ name: TENANT_NAME, slug: 'inteliflow' }, { onConflict: 'slug' })
    .select('id')
    .single();

  if (tenantErr) { console.error('Tenant error:', tenantErr.message); process.exit(1); }
  console.log(`Tenant ID: ${tenant.id}`);

  // Site
  console.log('Creating site...');
  const { data: site, error: siteErr } = await supabase
    .from('sites')
    .upsert(
      { tenant_id: tenant.id, name: SITE_NAME, slug: 'hq', timezone: 'Africa/Johannesburg' },
      { onConflict: 'id' }
    )
    .select('id')
    .single();

  if (siteErr) { console.error('Site error:', siteErr.message); process.exit(1); }
  console.log(`Site ID: ${site.id}`);

  // User profile
  console.log('Creating user profile...');
  const { error: userErr } = await supabase
    .from('users')
    .upsert(
      {
        id: userId,
        tenant_id: tenant.id,
        site_id: site.id,
        email: ADMIN_EMAIL,
        full_name: ADMIN_NAME,
        role: 'super_admin',
      },
      { onConflict: 'email' }
    );

  if (userErr) { console.error('User error:', userErr.message); process.exit(1); }

  console.log('\n✓ Seed complete!');
  console.log(`  Email:    ${ADMIN_EMAIL}`);
  console.log(`  Password: ${ADMIN_PASSWORD}`);
  console.log(`  Role:     super_admin`);
  console.log('\nYou can now log in at http://localhost:3000/login');
}

main();
