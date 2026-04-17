import { describe, it, expect, beforeEach } from 'vitest';
import { seedMockData, mockSupabaseData } from '../mocks/supabase';
import { fixtures } from '../fixtures';
import { POST as enrollmentCodesPOST } from '@/app/api/classrooms/[id]/enrollment-codes/route';
import { POST as revokePOST } from '@/app/api/devices/[id]/revoke/route';
import { PATCH as devicePATCH } from '@/app/api/devices/[id]/route';
import { POST as rotateTokenPOST } from '@/app/api/devices/[id]/rotate-token/route';
import { NextRequest } from 'next/server';

const classroomParams = (id: string) => Promise.resolve({ id });
const deviceParams = (id: string) => Promise.resolve({ id });

describe('POST /api/classrooms/[id]/enrollment-codes', () => {
  beforeEach(() => {
    seedMockData({
      classrooms: [{
        ...fixtures.classroom(),
        nodes: { ip_address: '192.168.1.100', tenant_id: 'tenant-001' },
      }],
    });
  });

  it('creates enrollment token with 48h TTL', async () => {
    const req = new NextRequest('http://localhost:3000/api/classrooms/classroom-001/enrollment-codes', {
      method: 'POST',
    });
    const res = await enrollmentCodesPOST(req, { params: classroomParams('classroom-001') });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.enrollment_token).toBeDefined();
    expect(body.expires_at).toBeDefined();

    const expiresAt = new Date(body.expires_at).getTime();
    const now = Date.now();
    const fortyEightHours = 48 * 60 * 60 * 1000;
    expect(expiresAt - now).toBeLessThanOrEqual(fortyEightHours + 5000);
    expect(expiresAt - now).toBeGreaterThan(fortyEightHours - 60000);
  });

  it('returns enrollment URL with node IP', async () => {
    const req = new NextRequest('http://localhost:3000/api/classrooms/classroom-001/enrollment-codes', {
      method: 'POST',
    });
    const res = await enrollmentCodesPOST(req, { params: classroomParams('classroom-001') });
    const body = await res.json();
    expect(body.enroll_url).toContain(':3100/enroll?code=');
  });

  it('returns QR code data string', async () => {
    const req = new NextRequest('http://localhost:3000/api/classrooms/classroom-001/enrollment-codes', {
      method: 'POST',
    });
    const res = await enrollmentCodesPOST(req, { params: classroomParams('classroom-001') });
    const body = await res.json();
    expect(body.qr_data).toBeDefined();
    expect(body.qr_data).toBe(body.enroll_url);
  });

  it('returns 404 for unknown classroom_id', async () => {
    const req = new NextRequest('http://localhost:3000/api/classrooms/nonexistent/enrollment-codes', {
      method: 'POST',
    });
    const res = await enrollmentCodesPOST(req, { params: classroomParams('nonexistent') });
    expect(res.status).toBe(404);
  });

  it('scopes token to the correct tenant', async () => {
    const req = new NextRequest('http://localhost:3000/api/classrooms/classroom-001/enrollment-codes', {
      method: 'POST',
    });
    await enrollmentCodesPOST(req, { params: classroomParams('classroom-001') });

    const devices = mockSupabaseData.devices;
    expect(devices.length).toBeGreaterThanOrEqual(1);
    const device = devices[devices.length - 1];
    expect(device.tenant_id).toBe('tenant-001');
    expect(device.classroom_id).toBe('classroom-001');
  });
});

describe('POST /api/devices/[id]/revoke', () => {
  beforeEach(() => {
    seedMockData({
      devices: [fixtures.device({ id: 'device-001', status: 'enrolled' })],
    });
  });

  it('sets device status to revoked', async () => {
    const req = new NextRequest('http://localhost:3000/api/devices/device-001/revoke', { method: 'POST' });
    const res = await revokePOST(req, { params: deviceParams('device-001') });
    expect(res.status).toBe(200);
    const device = mockSupabaseData.devices[0];
    expect(device.status).toBe('revoked');
  });

  it('returns ok: true on success', async () => {
    const req = new NextRequest('http://localhost:3000/api/devices/device-001/revoke', { method: 'POST' });
    const res = await revokePOST(req, { params: deviceParams('device-001') });
    const body = await res.json();
    expect(body.ok).toBe(true);
  });
});

describe('PATCH /api/devices/[id]', () => {
  beforeEach(() => {
    seedMockData({
      devices: [fixtures.device({ id: 'device-001', name: 'Old Name' })],
    });
  });

  it('updates device name', async () => {
    const req = new NextRequest('http://localhost:3000/api/devices/device-001', {
      method: 'PATCH',
      body: JSON.stringify({ name: 'New Device Name' }),
      headers: { 'Content-Type': 'application/json' },
    });
    const res = await devicePATCH(req, { params: deviceParams('device-001') });
    expect(res.status).toBe(200);
    const device = mockSupabaseData.devices[0];
    expect(device.name).toBe('New Device Name');
  });

  it('returns 400 when name is missing', async () => {
    const req = new NextRequest('http://localhost:3000/api/devices/device-001', {
      method: 'PATCH',
      body: JSON.stringify({}),
      headers: { 'Content-Type': 'application/json' },
    });
    const res = await devicePATCH(req, { params: deviceParams('device-001') });
    expect(res.status).toBe(400);
  });
});

describe('POST /api/devices/[id]/rotate-token', () => {
  beforeEach(() => {
    seedMockData({
      devices: [fixtures.device({ id: 'device-001', enrollment_token: 'old-token', status: 'enrolled' })],
    });
  });

  it('generates new enrollment_token', async () => {
    const req = new NextRequest('http://localhost:3000/api/devices/device-001/rotate-token', { method: 'POST' });
    const res = await rotateTokenPOST(req, { params: deviceParams('device-001') });
    const body = await res.json();
    expect(body.enrollment_token).toBeDefined();
    expect(body.enrollment_token).not.toBe('old-token');
  });

  it('resets status to pending', async () => {
    const req = new NextRequest('http://localhost:3000/api/devices/device-001/rotate-token', { method: 'POST' });
    await rotateTokenPOST(req, { params: deviceParams('device-001') });
    const device = mockSupabaseData.devices[0];
    expect(device.status).toBe('pending');
  });

  it('returns new token and expires_at', async () => {
    const req = new NextRequest('http://localhost:3000/api/devices/device-001/rotate-token', { method: 'POST' });
    const res = await rotateTokenPOST(req, { params: deviceParams('device-001') });
    const body = await res.json();
    expect(body.enrollment_token).toBeDefined();
    expect(body.expires_at).toBeDefined();
  });
});
