import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
dotenv.config({ path: '.env' });

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, { auth: { autoRefreshToken: false, persistSession: false } });

async function main() {
  const { data: jobs } = await supabase.from('sync_jobs').select('id, package_id, status, progress_pct, packages(name)').order('created_at', { ascending: false });
  console.log('All sync jobs:');
  console.log(JSON.stringify(jobs, null, 2));
}
main();
