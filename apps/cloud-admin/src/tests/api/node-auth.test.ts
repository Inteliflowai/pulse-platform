/**
 * Regression tests for node-token auth on previously-unauthenticated routes.
 *
 * These exist because the pre-hardening versions of these routes let any
 * network-reachable attacker forge heartbeats, progress rows, and update
 * status. We pin the contract: (1) no token → 401, (2) wrong token → 401,
 * (3) valid token for a different node → 401, (4) valid token on the
 * right node → 200.
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { seedMockData } from '../mocks/supabase';
import { fixtures } from '../fixtures';
import { POST as progressPOST } from '@/app/api/progress/route';
import { POST as updateStatusPOST } from '@/app/api/updates/[assignmentId]/status/route';
import { GET as updatesAvailableGET } from '@/app/api/updates/available/route';
import { NextRequest } from 'next/server';

const TOKEN_A = 'token-A';
const TOKEN_B = 'token-B';

function postJson(url: string, body: any, headers: Record<string, string> = {}) {
  return new NextRequest(url, {
    method: 'POST',
    body: JSON.stringify(body),
    headers: { 'Content-Type': 'application/json', ...headers },
  });
}

function get(url: string, headers: Record<string, string> = {}) {
  return new NextRequest(url, { method: 'GET', headers });
}

describe('node-token auth regression suite', () => {
  beforeEach(() => {
    seedMockData({
      nodes: [
        fixtures.node({ id: 'node-A', tenant_id: 'tenant-A', status: 'active', registration_token: TOKEN_A }),
        fixtures.node({ id: 'node-B', tenant_id: 'tenant-B', status: 'active', registration_token: TOKEN_B }),
      ],
    });
  });

  describe('POST /api/progress', () => {
    it('rejects request without token', async () => {
      const res = await progressPOST(postJson('http://localhost/api/progress', { progress_records: [] }));
      expect(res.status).toBe(401);
    });

    it('rejects request with wrong token', async () => {
      const res = await progressPOST(
        postJson('http://localhost/api/progress', { progress_records: [] }, { 'x-node-token': 'bogus' }),
      );
      expect(res.status).toBe(401);
    });

    it('accepts request with valid token', async () => {
      const res = await progressPOST(
        postJson('http://localhost/api/progress', { progress_records: [] }, { 'x-node-token': TOKEN_A }),
      );
      expect(res.status).toBe(200);
    });
  });

  describe('GET /api/updates/available', () => {
    it('rejects request without token', async () => {
      const res = await updatesAvailableGET(get('http://localhost/api/updates/available?node_id=node-A'));
      expect(res.status).toBe(401);
    });

    it("rejects node B's token being used to check node A", async () => {
      const res = await updatesAvailableGET(
        get('http://localhost/api/updates/available?node_id=node-A', { 'x-node-token': TOKEN_B }),
      );
      expect(res.status).toBe(401);
    });
  });

  describe('POST /api/updates/[assignmentId]/status', () => {
    it('rejects when assignment belongs to a different node', async () => {
      seedMockData({
        software_update_assignments: [
          { id: 'asgn-A', node_id: 'node-A', status: 'pending' } as any,
        ],
      });

      // Token B tries to mark node A's assignment as completed.
      const res = await updateStatusPOST(
        postJson('http://localhost/api/updates/asgn-A/status', { status: 'completed' }, { 'x-node-token': TOKEN_B }),
        { params: Promise.resolve({ assignmentId: 'asgn-A' }) },
      );
      expect(res.status).toBe(401);
    });

    it('accepts when assignment belongs to the calling node', async () => {
      seedMockData({
        software_update_assignments: [
          { id: 'asgn-A', node_id: 'node-A', status: 'pending' } as any,
        ],
      });

      const res = await updateStatusPOST(
        postJson('http://localhost/api/updates/asgn-A/status', { status: 'completed' }, { 'x-node-token': TOKEN_A }),
        { params: Promise.resolve({ assignmentId: 'asgn-A' }) },
      );
      expect(res.status).toBe(200);
    });
  });
});
