import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { seedMockData } from '../mocks/supabase';
import { fixtures } from '../fixtures';
import { GET } from '@/app/api/videos/route';
import { NextRequest } from 'next/server';

const SECRET = 'test-core-api-secret';

function makeRequest(search: string, headers: Record<string, string> = {}) {
  return new NextRequest(`http://localhost:3000/api/videos${search}`, {
    method: 'GET',
    headers,
  });
}

describe('GET /api/videos', () => {
  beforeEach(() => {
    process.env.CORE_API_SECRET = SECRET;

    seedMockData({
      tenants: [
        fixtures.tenant({ id: 'tenant-001', name: 'Acme Academy' }),
        fixtures.tenant({ id: 'tenant-002', name: 'Other School', slug: 'other' }),
      ],
      users: [
        fixtures.user({ id: 'user-001', email: 'teacher@acme.edu' }),
      ],
      assets: [
        // Ready video for tenant-001, uploaded by known user
        fixtures.asset({
          id: 'asset-video-1', tenant_id: 'tenant-001', uploaded_by: 'user-001',
          filename: 'fractions-intro.mp4', original_filename: 'Fractions Intro.mp4',
          mime_type: 'video/mp4', size_bytes: 150_000_000, duration_seconds: 540,
          status: 'ready', created_at: '2026-04-20T14:00:00Z',
        }),
        fixtures.asset({
          id: 'asset-video-2', tenant_id: 'tenant-001', uploaded_by: null,
          filename: 'lesson-two.webm', original_filename: 'Lesson Two.webm',
          mime_type: 'video/webm', size_bytes: 80_000_000, duration_seconds: 300,
          status: 'ready', created_at: '2026-04-21T10:00:00Z',
        }),
        // Non-video: PDF — should NOT appear
        fixtures.asset({
          id: 'asset-pdf', tenant_id: 'tenant-001',
          filename: 'worksheet.pdf', mime_type: 'application/pdf', status: 'ready',
        }),
        // Video but not ready — should NOT appear
        fixtures.asset({
          id: 'asset-pending', tenant_id: 'tenant-001',
          filename: 'processing.mp4', mime_type: 'video/mp4', status: 'processing',
        }),
        // Other tenant's video — should NOT appear
        fixtures.asset({
          id: 'asset-other-tenant', tenant_id: 'tenant-002',
          filename: 'other-school.mp4', mime_type: 'video/mp4', status: 'ready',
        }),
      ],
    });
  });

  afterEach(() => {
    delete process.env.CORE_API_SECRET;
  });

  it('returns 401 when X-Core-Secret header is missing', async () => {
    const res = await GET(makeRequest('?school_id=tenant-001'));
    expect(res.status).toBe(401);
  });

  it('returns 401 when X-Core-Secret is wrong', async () => {
    const res = await GET(makeRequest('?school_id=tenant-001', { 'x-core-secret': 'wrong' }));
    expect(res.status).toBe(401);
  });

  it('returns 401 when CORE_API_SECRET env is not set (fail closed)', async () => {
    delete process.env.CORE_API_SECRET;
    const res = await GET(makeRequest('?school_id=tenant-001', { 'x-core-secret': SECRET }));
    expect(res.status).toBe(401);
  });

  it('returns 400 when school_id is missing', async () => {
    const res = await GET(makeRequest('', { 'x-core-secret': SECRET }));
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toContain('school_id');
  });

  it('returns 404 when school_id is unknown', async () => {
    const res = await GET(makeRequest('?school_id=nonexistent', { 'x-core-secret': SECRET }));
    expect(res.status).toBe(404);
  });

  it('returns only ready video assets for the tenant', async () => {
    const res = await GET(makeRequest('?school_id=tenant-001', { 'x-core-secret': SECRET }));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.videos).toHaveLength(2);
    const ids = body.videos.map((v: any) => v.asset_id);
    expect(ids).toContain('asset-video-1');
    expect(ids).toContain('asset-video-2');
    expect(ids).not.toContain('asset-pdf');
    expect(ids).not.toContain('asset-pending');
    expect(ids).not.toContain('asset-other-tenant');
  });

  it('includes duration, size, title, and school context', async () => {
    const res = await GET(makeRequest('?school_id=tenant-001', { 'x-core-secret': SECRET }));
    const body = await res.json();
    const v = body.videos.find((x: any) => x.asset_id === 'asset-video-1');
    expect(v).toBeDefined();
    expect(v.title).toBe('Fractions Intro.mp4');
    expect(v.filename).toBe('fractions-intro.mp4');
    expect(v.duration_seconds).toBe(540);
    expect(v.size_bytes).toBe(150_000_000);
    expect(v.mime_type).toBe('video/mp4');
    expect(body.school).toEqual({ school_id: 'tenant-001', name: 'Acme Academy' });
  });

  it('enriches uploader_email when uploaded_by is known', async () => {
    const res = await GET(makeRequest('?school_id=tenant-001', { 'x-core-secret': SECRET }));
    const body = await res.json();
    const withUploader = body.videos.find((x: any) => x.asset_id === 'asset-video-1');
    const withoutUploader = body.videos.find((x: any) => x.asset_id === 'asset-video-2');
    expect(withUploader.uploader_email).toBe('teacher@acme.edu');
    expect(withoutUploader.uploader_email).toBeNull();
  });

  it('filters by q (filename substring)', async () => {
    const res = await GET(makeRequest('?school_id=tenant-001&q=fractions', { 'x-core-secret': SECRET }));
    const body = await res.json();
    expect(body.videos).toHaveLength(1);
    expect(body.videos[0].asset_id).toBe('asset-video-1');
  });

  it('respects limit and offset and returns total', async () => {
    const res = await GET(makeRequest('?school_id=tenant-001&limit=1&offset=0', { 'x-core-secret': SECRET }));
    const body = await res.json();
    expect(body.videos).toHaveLength(1);
    expect(body.total).toBe(2);
    expect(body.limit).toBe(1);
    expect(body.offset).toBe(0);

    const res2 = await GET(makeRequest('?school_id=tenant-001&limit=1&offset=1', { 'x-core-secret': SECRET }));
    const body2 = await res2.json();
    expect(body2.videos).toHaveLength(1);
    expect(body2.videos[0].asset_id).not.toBe(body.videos[0].asset_id);
  });

  it('returns empty list when tenant has no videos', async () => {
    const res = await GET(makeRequest('?school_id=tenant-002', { 'x-core-secret': SECRET }));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.videos).toHaveLength(1); // tenant-002 has one video in the seed
    expect(body.school.name).toBe('Other School');
  });
});
