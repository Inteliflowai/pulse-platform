import { describe, it, expect } from 'vitest';
import { validate } from '@/lib/validate';

describe('validate()', () => {
  it('returns null for valid body with all required fields', () => {
    const result = validate(
      { name: 'Test', age: 25 },
      [
        { field: 'name', required: true, type: 'string' },
        { field: 'age', required: true, type: 'number' },
      ]
    );
    expect(result).toBeNull();
  });

  it('returns error for missing required field', () => {
    const result = validate(
      { name: 'Test' },
      [{ field: 'email', required: true }]
    );
    expect(result).toContain('email');
  });

  it('returns error for wrong type', () => {
    const result = validate(
      { age: 'not-a-number' },
      [{ field: 'age', type: 'number' }]
    );
    expect(result).toContain('number');
  });

  it('returns error for invalid enum value', () => {
    const result = validate(
      { status: 'unknown' },
      [{ field: 'status', enum: ['active', 'inactive'] }]
    );
    expect(result).toContain('active');
  });

  it('returns error for string below min length', () => {
    const result = validate(
      { name: 'ab' },
      [{ field: 'name', type: 'string', min: 3 }]
    );
    expect(result).toContain('3');
  });

  it('returns error for string above max length', () => {
    const result = validate(
      { name: 'a very long name that exceeds the limit' },
      [{ field: 'name', type: 'string', max: 10 }]
    );
    expect(result).toContain('10');
  });

  it('skips optional field when not present', () => {
    const result = validate(
      { name: 'Test' },
      [
        { field: 'name', required: true },
        { field: 'optional_field', type: 'string' },
      ]
    );
    expect(result).toBeNull();
  });

  it('returns error for non-object body', () => {
    const result = validate(null, [{ field: 'name', required: true }]);
    expect(result).toContain('JSON object');
  });

  it('validates array type correctly', () => {
    const result = validate(
      { items: [1, 2, 3] },
      [{ field: 'items', type: 'array' }]
    );
    expect(result).toBeNull();
  });

  it('returns error when array expected but object given', () => {
    const result = validate(
      { items: { a: 1 } },
      [{ field: 'items', type: 'array' }]
    );
    expect(result).toContain('array');
  });
});
