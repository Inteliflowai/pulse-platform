import { NextResponse } from 'next/server';
import { createAdminSupabaseClient } from '@/lib/supabase/admin';

export async function GET() {
  const checks: Record<string, boolean> = { api: true, supabase: false };

  try {
    const supabase = createAdminSupabaseClient();
    const { error } = await supabase.from('tenants').select('id').limit(1);
    checks.supabase = !error;
  } catch {
    checks.supabase = false;
  }

  const healthy = Object.values(checks).every(Boolean);

  return NextResponse.json(
    { ok: healthy, checks, timestamp: new Date().toISOString(), version: '1.0.0' },
    { status: healthy ? 200 : 503 }
  );
}
