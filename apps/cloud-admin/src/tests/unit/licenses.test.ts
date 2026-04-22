import { describe, it, expect } from 'vitest';
import { resolveLicenseState, isLicenseUsable } from '@/lib/licenses';

describe('resolveLicenseState', () => {
  it('returns "missing" is not handled here; hasLicense wraps that', () => {
    // Sanity: resolveLicenseState never returns "missing" — it only operates on a row.
    const state = resolveLicenseState({ status: 'active', expires_at: null });
    expect(state).not.toBe('missing');
  });

  it('returns "active" for an active perpetual license', () => {
    expect(resolveLicenseState({ status: 'active', expires_at: null })).toBe('active');
  });

  it('returns "active" for an active license that has not yet expired', () => {
    const future = new Date(Date.now() + 30 * 86_400_000).toISOString();
    expect(resolveLicenseState({ status: 'active', expires_at: future })).toBe('active');
  });

  it('returns "expired" when expires_at is in the past regardless of status', () => {
    const past = new Date(Date.now() - 86_400_000).toISOString();
    expect(resolveLicenseState({ status: 'active', expires_at: past })).toBe('expired');
    expect(resolveLicenseState({ status: 'trial', expires_at: past })).toBe('expired');
  });

  it('returns "suspended" even if not expired — suspension overrides', () => {
    const future = new Date(Date.now() + 30 * 86_400_000).toISOString();
    expect(resolveLicenseState({ status: 'suspended', expires_at: future })).toBe('suspended');
    expect(resolveLicenseState({ status: 'suspended', expires_at: null })).toBe('suspended');
  });

  it('returns "trial" for an active trial license', () => {
    const future = new Date(Date.now() + 14 * 86_400_000).toISOString();
    expect(resolveLicenseState({ status: 'trial', expires_at: future })).toBe('trial');
  });
});

describe('isLicenseUsable', () => {
  it('treats active and trial as usable', () => {
    expect(isLicenseUsable('active')).toBe(true);
    expect(isLicenseUsable('trial')).toBe(true);
  });

  it('treats expired, suspended, missing as unusable', () => {
    expect(isLicenseUsable('expired')).toBe(false);
    expect(isLicenseUsable('suspended')).toBe(false);
    expect(isLicenseUsable('missing')).toBe(false);
  });
});
