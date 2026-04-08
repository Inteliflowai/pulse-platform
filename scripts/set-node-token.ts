import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
dotenv.config({ path: '.env' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { autoRefreshToken: false, persistSession: false } }
);

async function main() {
  const token = crypto.randomUUID();
  const { error } = await supabase
    .from('nodes')
    .update({ registration_token: token })
    .eq('id', '83d92f63-b84f-49b4-a572-9cc3dafe54c7');

  if (error) {
    console.log('Error:', error.message);
  } else {
    console.log('NODE_ID=83d92f63-b84f-49b4-a572-9cc3dafe54c7');
    console.log('NODE_REGISTRATION_TOKEN=' + token);
  }
}

main();
