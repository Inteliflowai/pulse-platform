/**
 * CORE webhook receiver — auth + generic event acceptance.
 *
 * Pins the contract: (1) X-Core-Secret is required and timing-safe-checked,
 * (2) malformed bodies return 400, (3) recognized-but-unhandled events still
 * return 200 with handled:false (CORE shouldn't retry), (4) every accepted
 * event lands in audit_logs for visibility.
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { seedMockData, mockSupabaseData } from '../mocks/supabase';
import { fixtures } from '../fixtures';
import { POST as webhookPOST } from '@/app/api/integrations/core/webhook/route';
import { NextRequest } from 'next/server';

const SECRET = 'test-core-secret';

function post(body: any, headers: Record<string, string> = {}) {
  return new NextRequest('http://localhost/api/integrations/core/webhook', {
    method: 'POST',
    body: JSON.stringify(body),
    headers: { 'Content-Type': 'application/json', ...headers },
  });
}

describe('POST /api/integrations/core/webhook', () => {
  beforeEach(() => {
    process.env.CORE_API_SECRET = SECRET;
    seedMockData({
      tenants: [fixtures.tenant({ id: 'tenant-A' })],
    });
  });

  it('rejects missing X-Core-Secret with 401', async () => {
    const res = await webhookPOST(post({ event_type: 'quiz_completed', tenant_id: 'tenant-A' }));
    expect(res.status).toBe(401);
  });

  it('rejects wrong X-Core-Secret with 401', async () => {
    const res = await webhookPOST(
      post({ event_type: 'quiz_completed', tenant_id: 'tenant-A' }, { 'x-core-secret': 'wrong' }),
    );
    expect(res.status).toBe(401);
  });

  it('rejects when CORE_API_SECRET env is unset (fail closed)', async () => {
    delete process.env.CORE_API_SECRET;
    const res = await webhookPOST(
      post({ event_type: 'quiz_completed', tenant_id: 'tenant-A' }, { 'x-core-secret': SECRET }),
    );
    expect(res.status).toBe(401);
  });

  it('rejects body missing event_type or tenant_id with 400', async () => {
    const res = await webhookPOST(post({ event_type: 'foo' }, { 'x-core-secret': SECRET }));
    expect(res.status).toBe(400);
  });

  it('accepts recognized-but-unhandled events with 200 + handled:false', async () => {
    const res = await webhookPOST(
      post({
        event_type: 'unknown_future_event',
        tenant_id: 'tenant-A',
        payload: { foo: 'bar' },
      }, { 'x-core-secret': SECRET }),
    );
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.ok).toBe(true);
    expect(body.handled).toBe(false);
  });

  it('records every accepted event in audit_logs', async () => {
    await webhookPOST(
      post({
        event_type: 'quiz_completed',
        tenant_id: 'tenant-A',
        payload: { quiz_id: 'q1', score: 85 },
      }, { 'x-core-secret': SECRET }),
    );
    const logs = mockSupabaseData.audit_logs.filter((l) => l.event_type === 'core_webhook.quiz_completed');
    expect(logs.length).toBe(1);
    expect(logs[0].metadata.payload.score).toBe(85);
  });
});
