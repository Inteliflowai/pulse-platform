import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
dotenv.config({ path: '.env' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { autoRefreshToken: false, persistSession: false } }
);

async function main() {
  // Update auth user email
  const { error: authErr } = await supabase.auth.admin.updateUserById(
    '9ece098d-b2c2-4323-8773-092cddae422c',
    { email: 'admin@inteliflowai.com', email_confirm: true, password: 'PulseAdmin123!' }
  );
  if (authErr) { console.log('Auth error:', authErr.message); return; }

  // Update users table
  const { error: dbErr } = await supabase
    .from('users')
    .update({ email: 'admin@inteliflowai.com' })
    .eq('id', '9ece098d-b2c2-4323-8773-092cddae422c');
  if (dbErr) { console.log('DB error:', dbErr.message); return; }

  // Test sign-in
  const { error: signErr } = await supabase.auth.signInWithPassword({
    email: 'admin@inteliflowai.com',
    password: 'PulseAdmin123!',
  });
  if (signErr) console.log('Sign-in FAILED:', signErr.message);
  else console.log('Done! Login: admin@inteliflowai.com / PulseAdmin123!');
}

main();
