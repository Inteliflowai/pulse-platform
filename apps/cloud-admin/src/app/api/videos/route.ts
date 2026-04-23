import { NextRequest, NextResponse } from 'next/server';
import { timingSafeEqual } from 'node:crypto';
import { createAdminSupabaseClient } from '@/lib/supabase/admin';

/**
 * GET /api/videos — CORE-facing read of a tenant's ready video assets.
 *
 * Consumed by CORE's lesson editor to render a picker dropdown so
 * teachers can map a Pulse video to a CORE quiz instead of pasting
 * asset_id UUIDs into the ops bridge page.
 *
 * Auth: X-Core-Secret header, timing-safe compare against CORE_API_SECRET.
 * Platform-to-platform secret — shared with CORE via Vercel env on both
 * sides. Distinct from the per-tenant Bearer keys used on the runtime
 * Pulse→CORE direction. See CLAUDE.md "Environment Setup".
 *
 * Contract:
 *   GET /api/videos?school_id=<uuid>&q=<search>&limit=100&offset=0
 *   → { videos: [...], total, limit, offset, school: { school_id, name } }
 *
 * school_id equals Pulse's tenant_id (enforced by the provisioning flow
 * in apps/cloud-admin/src/app/api/licenses/route.ts — school_id is sent
 * to CORE as the Pulse tenant_id at license creation time).
 */

const DEFAULT_LIMIT = 100;
const MAX_LIMIT = 500;

function authorized(request: NextRequest): boolean {
  const secret = process.env.CORE_API_SECRET;
  if (!secret) return false;
  const provided = request.headers.get('x-core-secret');
  if (!provided) return false;
  const a = Buffer.from(provided);
  const b = Buffer.from(secret);
  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}

function parsePositiveInt(value: string | null, fallback: number, max?: number): number {
  if (!value) return fallback;
  const n = parseInt(value, 10);
  if (!Number.isFinite(n) || n < 0) return fallback;
  return max != null ? Math.min(n, max) : n;
}

export async function GET(request: NextRequest) {
  if (!authorized(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const url = new URL(request.url);
  const schoolId = url.searchParams.get('school_id');
  const q = url.searchParams.get('q')?.trim() ?? '';
  const limit = Math.max(1, parsePositiveInt(url.searchParams.get('limit'), DEFAULT_LIMIT, MAX_LIMIT));
  const offset = parsePositiveInt(url.searchParams.get('offset'), 0);

  if (!schoolId) {
    return NextResponse.json({ error: 'school_id is required' }, { status: 400 });
  }

  const supabase = createAdminSupabaseClient();

  const { data: tenant } = await supabase
    .from('tenants')
    .select('id, name')
    .eq('id', schoolId)
    .single();

  if (!tenant) {
    return NextResponse.json({ error: 'Unknown school_id' }, { status: 404 });
  }

  let query = supabase
    .from('assets')
    .select('id, filename, original_filename, mime_type, size_bytes, duration_seconds, created_at, uploaded_by')
    .eq('tenant_id', schoolId)
    .eq('status', 'ready')
    .ilike('mime_type', 'video/%')
    .order('created_at', { ascending: false });

  if (q) {
    query = query.ilike('filename', `%${q}%`);
  }

  const { data: assets, error } = await query;
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const allAssets = assets ?? [];
  const total = allAssets.length;
  const page = allAssets.slice(offset, offset + limit);

  // Best-effort uploader email enrichment. One round-trip per page.
  const uploaderIds = Array.from(
    new Set(page.map((a: any) => a.uploaded_by).filter(Boolean)),
  ) as string[];
  const uploaderEmails = new Map<string, string>();
  if (uploaderIds.length > 0) {
    const { data: users } = await supabase
      .from('users')
      .select('id, email')
      .in('id', uploaderIds);
    for (const u of users ?? []) {
      uploaderEmails.set(u.id, u.email);
    }
  }

  const videos = page.map((a: any) => ({
    asset_id: a.id,
    title: a.original_filename ?? a.filename,
    filename: a.filename,
    mime_type: a.mime_type,
    size_bytes: a.size_bytes,
    duration_seconds: a.duration_seconds,
    created_at: a.created_at,
    uploader_email: a.uploaded_by ? uploaderEmails.get(a.uploaded_by) ?? null : null,
  }));

  return NextResponse.json({
    videos,
    total,
    limit,
    offset,
    school: {
      school_id: tenant.id,
      name: tenant.name,
    },
  });
}
