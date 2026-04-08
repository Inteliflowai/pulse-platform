'use client';

import { useState, useEffect, useCallback } from 'react';
import { createSupabaseBrowserClient } from '@/lib/supabase/browser';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';

interface SyncJob {
  id: string;
  status: string;
  progress_pct: number;
  bytes_transferred: number;
  bytes_total: number;
  retries: number;
  started_at: string | null;
  updated_at: string;
  packages: { name: string } | null;
  nodes: { name: string } | null;
}

function statusBadge(status: string) {
  const map: Record<string, 'success' | 'warning' | 'destructive' | 'secondary'> = {
    completed: 'success', in_progress: 'warning', failed: 'destructive', pending: 'secondary', cancelled: 'secondary',
  };
  return <Badge variant={map[status] ?? 'secondary'}>{status}</Badge>;
}

function formatBytes(bytes: number) {
  if (!bytes) return '0 B';
  if (bytes < 1048576) return `${(bytes / 1024).toFixed(0)} KB`;
  if (bytes < 1073741824) return `${(bytes / 1048576).toFixed(1)} MB`;
  return `${(bytes / 1073741824).toFixed(2)} GB`;
}

export function SyncJobsTab() {
  const [jobs, setJobs] = useState<SyncJob[]>([]);
  const [loading, setLoading] = useState(true);
  const supabase = createSupabaseBrowserClient();

  const loadJobs = useCallback(async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    const { data: profile } = await supabase.from('users').select('tenant_id').eq('id', user.id).single();
    if (!profile) return;

    const { data } = await supabase
      .from('sync_jobs')
      .select('*, packages(name), nodes(name)')
      .order('created_at', { ascending: false })
      .limit(50);

    setJobs((data as any) ?? []);
    setLoading(false);
  }, []);

  useEffect(() => {
    loadJobs();
    const interval = setInterval(loadJobs, 30_000);
    return () => clearInterval(interval);
  }, [loadJobs]);

  return (
    <Card>
      <CardContent className="p-0">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Package</TableHead>
              <TableHead>Node</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Progress</TableHead>
              <TableHead>Transferred</TableHead>
              <TableHead>Retries</TableHead>
              <TableHead>Started</TableHead>
              <TableHead>Updated</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading && (
              <TableRow><TableCell colSpan={8} className="text-center text-gray-500">Loading...</TableCell></TableRow>
            )}
            {!loading && jobs.length === 0 && (
              <TableRow><TableCell colSpan={8} className="text-center text-gray-500">No sync jobs</TableCell></TableRow>
            )}
            {jobs.map((job) => (
              <TableRow key={job.id}>
                <TableCell className="font-medium">{job.packages?.name ?? '—'}</TableCell>
                <TableCell>{job.nodes?.name ?? '—'}</TableCell>
                <TableCell>{statusBadge(job.status)}</TableCell>
                <TableCell>
                  <div className="flex items-center gap-2">
                    <div className="h-1.5 w-16 rounded-full bg-gray-700">
                      <div className="h-1.5 rounded-full bg-brand-primary transition-all" style={{ width: `${Math.min(job.progress_pct, 100)}%` }} />
                    </div>
                    <span className="text-xs">{job.progress_pct}%</span>
                  </div>
                </TableCell>
                <TableCell className="text-xs">{formatBytes(job.bytes_transferred)} / {formatBytes(job.bytes_total)}</TableCell>
                <TableCell>{job.retries}</TableCell>
                <TableCell className="text-xs">{job.started_at ? new Date(job.started_at).toLocaleString() : '—'}</TableCell>
                <TableCell className="text-xs">{new Date(job.updated_at).toLocaleString()}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}
