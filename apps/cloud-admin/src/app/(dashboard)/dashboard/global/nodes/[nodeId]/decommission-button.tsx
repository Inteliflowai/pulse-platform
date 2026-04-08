'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { createSupabaseBrowserClient } from '@/lib/supabase/browser';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';

export function DecommissionButton({ nodeId, nodeName }: { nodeId: string; nodeName: string }) {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  async function handleDecommission() {
    setLoading(true);
    const supabase = createSupabaseBrowserClient();
    await supabase
      .from('nodes')
      .update({ status: 'decommissioned' })
      .eq('id', nodeId);

    setOpen(false);
    setLoading(false);
    router.refresh();
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="destructive">Decommission Node</Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Decommission Node</DialogTitle>
          <DialogDescription>
            Are you sure you want to decommission <strong>{nodeName}</strong>? This will
            mark the node as decommissioned and it will no longer receive sync jobs or heartbeats.
          </DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
          <Button variant="destructive" onClick={handleDecommission} disabled={loading}>
            {loading ? 'Decommissioning...' : 'Confirm Decommission'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
