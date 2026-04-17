import { describe, it, expect } from 'vitest';

/**
 * Pure-function tests for heartbeat alert detection logic.
 * Mirrors the logic in /api/nodes/heartbeat/route.ts without importing it.
 */

interface HeartbeatAlertInput {
  storage_used_gb: number;
  storage_total_gb: number;
  jellyfin_reachable: boolean;
  wan_connected: boolean;
  cpu_usage_pct: number;
  prev_wan_connected?: boolean;
  cpu_high_count?: number;
}

interface Alert {
  type: string;
  severity: string;
}

function detectHeartbeatAlerts(input: HeartbeatAlertInput): Alert[] {
  const alerts: Alert[] = [];

  // Storage alerts
  if (input.storage_total_gb > 0) {
    const storagePct = input.storage_used_gb / input.storage_total_gb;
    if (storagePct > 0.95) {
      alerts.push({ type: 'storage_critical', severity: 'critical' });
    } else if (storagePct > 0.85) {
      alerts.push({ type: 'storage_high', severity: 'warning' });
    }
  }

  // Jellyfin unreachable
  if (!input.jellyfin_reachable) {
    alerts.push({ type: 'jellyfin_unreachable', severity: 'warning' });
  }

  // WAN restored
  if (input.wan_connected && input.prev_wan_connected === false) {
    alerts.push({ type: 'wan_restored', severity: 'info' });
  }

  // CPU sustained high (3+ consecutive heartbeats > 90%)
  const newCpuHighCount = input.cpu_usage_pct > 90
    ? (input.cpu_high_count ?? 0) + 1
    : 0;

  if (newCpuHighCount >= 3) {
    alerts.push({ type: 'cpu_sustained_high', severity: 'warning' });
  }

  return alerts;
}

describe('detectHeartbeatAlerts()', () => {
  it('returns storage_high alert when usage > 85%', () => {
    const alerts = detectHeartbeatAlerts({
      storage_used_gb: 870,
      storage_total_gb: 1000,
      jellyfin_reachable: true,
      wan_connected: true,
      cpu_usage_pct: 50,
    });
    expect(alerts.some((a) => a.type === 'storage_high')).toBe(true);
  });

  it('returns storage_critical alert when usage > 95%', () => {
    const alerts = detectHeartbeatAlerts({
      storage_used_gb: 960,
      storage_total_gb: 1000,
      jellyfin_reachable: true,
      wan_connected: true,
      cpu_usage_pct: 50,
    });
    expect(alerts.some((a) => a.type === 'storage_critical')).toBe(true);
    expect(alerts.find((a) => a.type === 'storage_critical')?.severity).toBe('critical');
  });

  it('returns no storage alert when usage < 85%', () => {
    const alerts = detectHeartbeatAlerts({
      storage_used_gb: 500,
      storage_total_gb: 1000,
      jellyfin_reachable: true,
      wan_connected: true,
      cpu_usage_pct: 50,
    });
    expect(alerts.some((a) => a.type.startsWith('storage_'))).toBe(false);
  });

  it('returns jellyfin_unreachable when jellyfin_reachable is false', () => {
    const alerts = detectHeartbeatAlerts({
      storage_used_gb: 200,
      storage_total_gb: 1000,
      jellyfin_reachable: false,
      wan_connected: true,
      cpu_usage_pct: 50,
    });
    expect(alerts.some((a) => a.type === 'jellyfin_unreachable')).toBe(true);
  });

  it('returns wan_restored when wan_connected flips from false to true', () => {
    const alerts = detectHeartbeatAlerts({
      storage_used_gb: 200,
      storage_total_gb: 1000,
      jellyfin_reachable: true,
      wan_connected: true,
      cpu_usage_pct: 50,
      prev_wan_connected: false,
    });
    expect(alerts.some((a) => a.type === 'wan_restored')).toBe(true);
  });

  it('returns no alert when wan_connected is stable true', () => {
    const alerts = detectHeartbeatAlerts({
      storage_used_gb: 200,
      storage_total_gb: 1000,
      jellyfin_reachable: true,
      wan_connected: true,
      cpu_usage_pct: 50,
      prev_wan_connected: true,
    });
    expect(alerts.some((a) => a.type === 'wan_restored')).toBe(false);
  });

  it('returns cpu_sustained_high after 3 consecutive heartbeats > 90%', () => {
    const alerts = detectHeartbeatAlerts({
      storage_used_gb: 200,
      storage_total_gb: 1000,
      jellyfin_reachable: true,
      wan_connected: true,
      cpu_usage_pct: 95,
      cpu_high_count: 2, // this is the 3rd consecutive
    });
    expect(alerts.some((a) => a.type === 'cpu_sustained_high')).toBe(true);
  });

  it('does not return cpu_sustained_high after only 2 consecutive', () => {
    const alerts = detectHeartbeatAlerts({
      storage_used_gb: 200,
      storage_total_gb: 1000,
      jellyfin_reachable: true,
      wan_connected: true,
      cpu_usage_pct: 95,
      cpu_high_count: 1, // only 2nd consecutive
    });
    expect(alerts.some((a) => a.type === 'cpu_sustained_high')).toBe(false);
  });
});
