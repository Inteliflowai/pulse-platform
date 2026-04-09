import { describe, it, expect } from 'vitest';
import {
  NodeStatus, DeviceStatus, SyncJobStatus, AssetStatus, PackageStatus,
  API_VERSION, HEARTBEAT_INTERVAL_MS, SYNC_RETRY_MAX, ENROLLMENT_TOKEN_TTL_HOURS, DEFAULT_ROLES,
} from '../src';

describe('Shared Constants', () => {
  it('API_VERSION is v1', () => {
    expect(API_VERSION).toBe('v1');
  });

  it('HEARTBEAT_INTERVAL_MS is 60 seconds', () => {
    expect(HEARTBEAT_INTERVAL_MS).toBe(60_000);
  });

  it('SYNC_RETRY_MAX is 5', () => {
    expect(SYNC_RETRY_MAX).toBe(5);
  });

  it('ENROLLMENT_TOKEN_TTL_HOURS is 48', () => {
    expect(ENROLLMENT_TOKEN_TTL_HOURS).toBe(48);
  });

  it('DEFAULT_ROLES has all 6 roles', () => {
    expect(Object.keys(DEFAULT_ROLES)).toHaveLength(6);
    expect(DEFAULT_ROLES.super_admin).toBe('Super Admin');
    expect(DEFAULT_ROLES.student).toBe('Student');
  });
});

describe('Shared Enums', () => {
  it('NodeStatus has expected values', () => {
    expect(NodeStatus.Active).toBe('active');
    expect(NodeStatus.Offline).toBe('offline');
    expect(NodeStatus.Pending).toBe('pending');
    expect(NodeStatus.Decommissioned).toBe('decommissioned');
  });

  it('DeviceStatus has expected values', () => {
    expect(DeviceStatus.Enrolled).toBe('enrolled');
    expect(DeviceStatus.Revoked).toBe('revoked');
  });

  it('SyncJobStatus has expected values', () => {
    expect(SyncJobStatus.Pending).toBe('pending');
    expect(SyncJobStatus.InProgress).toBe('in_progress');
    expect(SyncJobStatus.Completed).toBe('completed');
    expect(SyncJobStatus.Failed).toBe('failed');
  });

  it('AssetStatus has expected values', () => {
    expect(AssetStatus.Ready).toBe('ready');
    expect(AssetStatus.Processing).toBe('processing');
    expect(AssetStatus.Error).toBe('error');
  });

  it('PackageStatus has expected values', () => {
    expect(PackageStatus.Draft).toBe('draft');
    expect(PackageStatus.Published).toBe('published');
    expect(PackageStatus.Deprecated).toBe('deprecated');
  });
});
