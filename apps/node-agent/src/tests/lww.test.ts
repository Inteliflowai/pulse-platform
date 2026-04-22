import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { mkdtempSync, rmSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';

// Use a unique temp dir so the real better-sqlite3 db doesn't collide with other tests.
const TMP = mkdtempSync(join(tmpdir(), 'pulse-lww-'));
process.env.DATA_DIR = TMP;

// Must import after DATA_DIR is set so db.ts picks it up.
const db = await import('../db');

describe('LWW conflict resolution', () => {
  beforeAll(() => {
    db.initDb();
  });

  afterAll(() => {
    try { rmSync(TMP, { recursive: true, force: true }); } catch {}
  });

  it('cacheSequence accepts first write when no cloud_updated_at', () => {
    db.cacheSequence('s1', 'Seq 1', 'K-2', 'Math', 'g1', 'sub1', [{ id: 'i1' }]);
    const row = db.getCachedSequence('s1') as any;
    expect(row.name).toBe('Seq 1');
  });

  it('cacheSequence upgrades cache when incoming cloud_updated_at is newer', () => {
    db.cacheSequence('s2', 'Seq v1', 'K-2', 'Math', 'g1', 'sub1', [], '2026-01-01T00:00:00Z');
    db.cacheSequence('s2', 'Seq v2', 'K-2', 'Math', 'g1', 'sub1', [], '2026-02-01T00:00:00Z');
    const row = db.getCachedSequence('s2') as any;
    expect(row.name).toBe('Seq v2');
  });

  it('cacheSequence rejects stale writes when incoming cloud_updated_at is older', () => {
    db.cacheSequence('s3', 'Fresh', 'K-2', 'Math', 'g1', 'sub1', [], '2026-03-01T00:00:00Z');
    db.cacheSequence('s3', 'Stale', 'K-2', 'Math', 'g1', 'sub1', [], '2026-01-01T00:00:00Z');
    const row = db.getCachedSequence('s3') as any;
    expect(row.name).toBe('Fresh');
  });

  it('setConductorState rejects stale client_updated_at', () => {
    db.setConductorState('c1', 'seq1', 5, 'active', 't1', '2026-03-01T00:00:00Z');
    db.setConductorState('c1', 'seq1', 2, 'active', 't1', '2026-02-01T00:00:00Z');
    const state = db.getConductorState('c1') as any;
    expect(state.current_item_index).toBe(5);
  });

  it('setConductorState accepts newer client_updated_at', () => {
    db.setConductorState('c2', 'seq1', 0, 'active', 't1', '2026-01-01T00:00:00Z');
    db.setConductorState('c2', 'seq1', 7, 'active', 't1', '2026-04-01T00:00:00Z');
    const state = db.getConductorState('c2') as any;
    expect(state.current_item_index).toBe(7);
  });
});
