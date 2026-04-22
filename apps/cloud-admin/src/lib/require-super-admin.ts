/**
 * Gate a route behind the super_admin role.
 *
 * Returns the authenticated user's id on success, or a NextResponse on
 * failure so the handler can short-circuit cleanly.
 *
 * Uses the same discriminated-union pattern as requireNodeToken so the
 * test mock layer (which returns plain objects from NextResponse.json)
 * can detect failures without relying on instanceof.
 */

import { NextResponse } from 'next/server';
import { createSupabaseServerClient } from '@/lib/supabase/server';

export type SuperAdminResult =
  | { ok: true; userId: string }
  | { ok: false; response: NextResponse };

export async function requireSuperAdmin(): Promise<SuperAdminResult> {
  const sb = await createSupabaseServerClient();
  const { data: { user } } = await sb.auth.getUser();
  if (!user) {
    return { ok: false, response: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }) };
  }
  const { data: profile } = await sb.from('users').select('role').eq('id', user.id).single();
  if (!profile || profile.role !== 'super_admin') {
    return { ok: false, response: NextResponse.json({ error: 'super_admin only' }, { status: 403 }) };
  }
  return { ok: true, userId: user.id };
}
