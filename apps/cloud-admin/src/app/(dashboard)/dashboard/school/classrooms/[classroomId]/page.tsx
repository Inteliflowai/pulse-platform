'use client';

import { useState, useEffect, useCallback } from 'react';
import { useParams } from 'next/navigation';
import { createSupabaseBrowserClient } from '@/lib/supabase/browser';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog';
import { QRCodeSVG } from 'qrcode.react';
import { ArrowLeft, QrCode, Copy, Check, Ban, Pencil } from 'lucide-react';
import Link from 'next/link';

function statusBadge(status: string) {
  const map: Record<string, 'success' | 'warning' | 'destructive' | 'secondary'> = {
    enrolled: 'success', pending: 'warning', revoked: 'destructive',
  };
  return <Badge variant={map[status] ?? 'secondary'}>{status}</Badge>;
}

export default function ClassroomDetailPage() {
  const { classroomId } = useParams<{ classroomId: string }>();
  const [classroom, setClassroom] = useState<any>(null);
  const [devices, setDevices] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [enrollData, setEnrollData] = useState<any>(null);
  const [enrollOpen, setEnrollOpen] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [copied, setCopied] = useState('');
  const [renameId, setRenameId] = useState('');
  const [renameName, setRenameName] = useState('');

  const load = useCallback(async () => {
    const res = await fetch(`/api/classrooms/${classroomId}`);
    if (res.ok) {
      const data = await res.json();
      setClassroom(data.classroom);
      setDevices(data.devices);
    }
    setLoading(false);
  }, [classroomId]);

  useEffect(() => { load(); }, [load]);

  async function generateCode() {
    setGenerating(true);
    const res = await fetch(`/api/classrooms/${classroomId}/enrollment-codes`, { method: 'POST' });
    if (res.ok) {
      const data = await res.json();
      setEnrollData(data);
      setEnrollOpen(true);
    }
    setGenerating(false);
    load();
  }

  async function revokeDevice(deviceId: string) {
    await fetch(`/api/devices/${deviceId}/revoke`, { method: 'POST' });
    load();
  }

  async function renameDevice(deviceId: string) {
    await fetch(`/api/devices/${deviceId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: renameName }),
    });
    setRenameId('');
    setRenameName('');
    load();
  }

  function copyText(text: string, key: string) {
    navigator.clipboard.writeText(text);
    setCopied(key);
    setTimeout(() => setCopied(''), 2000);
  }

  if (loading) return <div className="text-gray-400 py-20 text-center">Loading...</div>;
  if (!classroom) return <div className="text-gray-400 py-20 text-center">Classroom not found</div>;

  const nodeIp = (classroom as any).nodes?.ip_address ?? 'NODE_IP';

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <Link href="/dashboard/school/classrooms" className="text-gray-400 hover:text-gray-200"><ArrowLeft className="h-5 w-5" /></Link>
        <h1 className="text-2xl font-bold text-gray-100">{classroom.name}</h1>
        <Badge variant="success">{classroom.status}</Badge>
      </div>

      {/* Metadata */}
      <Card>
        <CardHeader><CardTitle>Details</CardTitle></CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
            <div><span className="text-gray-400 block">Room Code</span>{classroom.room_code ?? '—'}</div>
            <div><span className="text-gray-400 block">Node</span>{(classroom as any).nodes?.name ?? '—'}</div>
            <div><span className="text-gray-400 block">Capacity</span>{classroom.capacity ?? '—'}</div>
            <div><span className="text-gray-400 block">Enrolled Devices</span>{devices.filter((d) => d.status === 'enrolled').length}</div>
          </div>
          <Button onClick={generateCode} disabled={generating} className="mt-4">
            <QrCode className="mr-2 h-4 w-4" />{generating ? 'Generating...' : 'Generate Enrollment Code'}
          </Button>
        </CardContent>
      </Card>

      {/* Enrollment code dialog */}
      <Dialog open={enrollOpen} onOpenChange={setEnrollOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Device Setup Sheet</DialogTitle>
            <DialogDescription>Print or share this with the device operator.</DialogDescription>
          </DialogHeader>
          {enrollData && (
            <div className="space-y-4">
              {[
                { label: 'Enrollment URL', value: enrollData.enroll_url },
                { label: 'Token', value: enrollData.enrollment_token },
                { label: 'Expires', value: new Date(enrollData.expires_at).toLocaleString() },
              ].map((item) => (
                <div key={item.label} className="flex items-center justify-between rounded-lg border border-gray-700 bg-brand-bg p-3">
                  <div><p className="text-xs text-gray-400">{item.label}</p><p className="font-mono text-sm text-gray-200 break-all">{item.value}</p></div>
                  <button onClick={() => copyText(item.value, item.label)} className="ml-2 text-gray-400 hover:text-gray-200">
                    {copied === item.label ? <Check className="h-4 w-4 text-emerald-400" /> : <Copy className="h-4 w-4" />}
                  </button>
                </div>
              ))}
              <div className="flex justify-center py-4">
                <div className="rounded-lg bg-white p-4"><QRCodeSVG value={enrollData.qr_data} size={180} /></div>
              </div>
              <div className="rounded-lg border border-gray-700 bg-brand-bg p-4">
                <p className="text-xs font-medium text-gray-400 mb-1">Instructions</p>
                <p className="text-xs text-gray-300">On the device, open a browser and navigate to the enrollment URL above, or scan the QR code.</p>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Devices table */}
      <Card>
        <CardHeader><CardTitle>Enrolled Devices</CardTitle></CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Type</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Last Seen</TableHead>
                <TableHead>IP</TableHead>
                <TableHead className="w-24">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {devices.length === 0 && <TableRow><TableCell colSpan={6} className="text-center text-gray-500">No devices</TableCell></TableRow>}
              {devices.map((d) => (
                <TableRow key={d.id}>
                  <TableCell className="font-medium">
                    {renameId === d.id ? (
                      <div className="flex gap-1">
                        <Input value={renameName} onChange={(e) => setRenameName(e.target.value)} className="h-7 text-xs" />
                        <Button size="sm" onClick={() => renameDevice(d.id)} className="h-7">Save</Button>
                      </div>
                    ) : d.name}
                  </TableCell>
                  <TableCell className="text-xs">{d.device_type}</TableCell>
                  <TableCell>{statusBadge(d.status)}</TableCell>
                  <TableCell className="text-xs">{d.last_seen_at ? new Date(d.last_seen_at).toLocaleString() : '—'}</TableCell>
                  <TableCell className="font-mono text-xs">{d.ip_address ?? '—'}</TableCell>
                  <TableCell>
                    <div className="flex gap-1">
                      {d.status !== 'revoked' && (
                        <button onClick={() => revokeDevice(d.id)} className="text-red-400 hover:text-red-300" title="Revoke">
                          <Ban className="h-4 w-4" />
                        </button>
                      )}
                      <button onClick={() => { setRenameId(d.id); setRenameName(d.name); }} className="text-gray-400 hover:text-gray-200" title="Rename">
                        <Pencil className="h-4 w-4" />
                      </button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
