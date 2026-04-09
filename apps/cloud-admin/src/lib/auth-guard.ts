import { redirect } from 'next/navigation';
import { createSupabaseServerClient } from '@/lib/supabase/server';

type Role = 'super_admin' | 'tenant_admin' | 'site_admin' | 'content_manager' | 'teacher' | 'student';

export async function requireRole(...allowedRoles: Role[]) {
  const supabase = await createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) redirect('/login');

  const { data: profile } = await supabase
    .from('users')
    .select('role')
    .eq('id', user.id)
    .single();

  if (!profile || !allowedRoles.includes(profile.role as Role)) {
    redirect('/dashboard/school');
  }

  return profile.role as Role;
}

export async function getUserProfile() {
  const supabase = await createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;

  const { data: profile } = await supabase
    .from('users')
    .select('*')
    .eq('id', user.id)
    .single();

  return profile;
}
