import { describe, it, expect } from 'vitest';
import { createHash } from 'crypto';

// Pure utility functions for testing checksum logic
function computeChecksum(buffer: Buffer): string {
  return createHash('sha256').update(buffer).digest('hex');
}

function verifyChecksum(buffer: Buffer, expected: string): boolean {
  return computeChecksum(buffer) === expected;
}

describe('computeChecksum()', () => {
  it('returns hex string for buffer input', () => {
    const result = computeChecksum(Buffer.from('hello world'));
    expect(result).toMatch(/^[0-9a-f]{64}$/);
  });

  it('returns same checksum for same content', () => {
    const a = computeChecksum(Buffer.from('test data'));
    const b = computeChecksum(Buffer.from('test data'));
    expect(a).toBe(b);
  });

  it('returns different checksum for different content', () => {
    const a = computeChecksum(Buffer.from('data-a'));
    const b = computeChecksum(Buffer.from('data-b'));
    expect(a).not.toBe(b);
  });

  it('handles empty buffer', () => {
    const result = computeChecksum(Buffer.from(''));
    expect(result).toMatch(/^[0-9a-f]{64}$/);
    // SHA-256 of empty string is a known constant
    expect(result).toBe('e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855');
  });
});

describe('verifyChecksum()', () => {
  it('returns true when checksum matches', () => {
    const data = Buffer.from('test content');
    const hash = computeChecksum(data);
    expect(verifyChecksum(data, hash)).toBe(true);
  });

  it('returns false when checksum does not match', () => {
    const data = Buffer.from('test content');
    expect(verifyChecksum(data, 'invalid-hash')).toBe(false);
  });
});
