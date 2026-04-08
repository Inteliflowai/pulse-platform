import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
dotenv.config({ path: '.env' });

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, { auth: { autoRefreshToken: false, persistSession: false } });

async function main() {
  // Force complete the old stuck job
  const { data, error } = await supabase
    .from('sync_jobs')
    .update({ status: 'completed', progress_pct: 100, completed_at: new Date().toISOString() })
    .eq('id', '97b7cc8f-617a-4aec-8b36-c7f552beb4ee')
    .select();

  console.log('Update result:', JSON.stringify(data), error?.message);

  // Check all jobs now
  const { data: jobs } = await supabase.from('sync_jobs').select('id, status, packages(name)').order('created_at', { ascending: false });
  console.log('All jobs after fix:', JSON.stringify(jobs, null, 2));
}
main();
