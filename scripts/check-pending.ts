import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
dotenv.config({ path: '.env' });

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, { auth: { autoRefreshToken: false, persistSession: false } });

async function main() {
  const { data, error } = await supabase
    .from('sync_jobs')
    .select('id, node_id, status, packages(name, manifest)')
    .eq('node_id', '83d92f63-b84f-49b4-a572-9cc3dafe54c7')
    .in('status', ['pending', 'in_progress']);

  console.log('Pending/in_progress jobs for this node:');
  console.log(JSON.stringify(data?.map(j => ({ id: j.id, status: j.status, pkg: (j as any).packages?.name })), null, 2));
  if (error) console.log('Error:', error);
}
main();
