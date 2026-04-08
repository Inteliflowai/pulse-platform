import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import { resolve } from 'path';

dotenv.config({ path: resolve(process.cwd(), '.env') });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { autoRefreshToken: false, persistSession: false } }
);

async function main() {
  const { data: { users } } = await supabase.auth.admin.listUsers();
  const admin = users.find((u) => u.email === 'admin@inteliflow.com');
  if (!admin) { console.log('User not found'); return; }
  console.log('User ID:', admin.id);
  console.log('Email confirmed:', admin.email_confirmed_at ? 'yes' : 'no');

  // Reset password
  const { error: updateErr } = await supabase.auth.admin.updateUserById(admin.id, {
    password: 'PulseAdmin123!',
    email_confirm: true,
  });
  if (updateErr) { console.log('Update error:', updateErr.message); return; }
  console.log('Password reset OK');

  // Test sign-in with anon key (like the browser would)
  const anonClient = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );

  const { data: signIn, error: signErr } = await anonClient.auth.signInWithPassword({
    email: 'admin@inteliflow.com',
    password: 'PulseAdmin123!',
  });

  if (signErr) console.log('Sign-in FAILED:', signErr.message, signErr.status);
  else console.log('Sign-in OK, got session:', !!signIn.session);
}

main();
