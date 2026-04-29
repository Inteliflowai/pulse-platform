'use client';

import { useEffect, useState } from 'react';
import { createSupabaseBrowserClient } from '@/lib/supabase/browser';
import type { RealtimeChannel } from '@supabase/supabase-js';

/**
 * Subscribe to real-time changes on a Supabase table.
 * Automatically cleans up on unmount.
 *
 * Usage:
 *   const { data, refresh } = useRealtimeTable('nodes', { column: 'tenant_id', value: tenantId });
 */
export function useRealtimeTable<T = any>(
  table: string,
  filter?: { column: string; value: string },
  initialData: T[] = []
) {
  const [data, setData] = useState<T[]>(initialData);
  const [loading, setLoading] = useState(true);

  const supabase = createSupabaseBrowserClient();

  async function loadData() {
    let query = supabase.from(table).select('*').order('created_at', { ascending: false }).limit(100);
    if (filter) query = query.eq(filter.column, filter.value);
    const { data: rows } = await query;
    setData((rows ?? []) as T[]);
    setLoading(false);
  }

  useEffect(() => {
    loadData();

    // Subscribe to real-time changes
    const channelName = `pulse-${table}-${filter?.value ?? 'all'}`;
    let channel: RealtimeChannel;

    try {
      channel = supabase
        .channel(channelName)
        .on('postgres_changes', {
          event: '*',
          schema: 'public',
          table,
          ...(filter ? { filter: `${filter.column}=eq.${filter.value}` } : {}),
        }, (payload) => {
          if (payload.eventType === 'INSERT') {
            setData((prev) => [payload.new as T, ...prev]);
          } else if (payload.eventType === 'UPDATE') {
            setData((prev) => prev.map((item: any) => item.id === (payload.new as any).id ? payload.new as T : item));
          } else if (payload.eventType === 'DELETE') {
            setData((prev) => prev.filter((item: any) => item.id !== (payload.old as any).id));
          }
        })
        .subscribe();
    } catch {
      // Realtime not available, fall back to polling
    }

    return () => {
      try { supabase.removeChannel(channel); } catch {}
    };
  }, [table, filter?.value]);

  return { data, loading, refresh: loadData };
}

/**
 * Subscribe to any change on a table and invoke a callback. Use this when
 * the existing page already does a joined/aggregated `load()` and you just
 * want a push signal to re-fire it instead of polling on a 30s interval.
 *
 * Silently no-ops if Supabase Realtime isn't enabled on the publication for
 * that table — the page keeps working via whatever fallback (polling, manual
 * refresh) the caller has set up.
 */
export function useTableInvalidation(
  tables: string | string[],
  onChange: () => void,
  filter?: { column: string; value: string }
) {
  const supabase = createSupabaseBrowserClient();

  useEffect(() => {
    const list = Array.isArray(tables) ? tables : [tables];
    const channels: RealtimeChannel[] = [];

    for (const table of list) {
      try {
        const ch = supabase
          .channel(`pulse-invalidate-${table}-${filter?.value ?? 'all'}`)
          .on('postgres_changes', {
            event: '*',
            schema: 'public',
            table,
            ...(filter ? { filter: `${filter.column}=eq.${filter.value}` } : {}),
          }, () => onChange())
          .subscribe();
        channels.push(ch);
      } catch {
        // Realtime publication not enabled for this table — stay silent.
      }
    }

    return () => {
      for (const ch of channels) {
        try { supabase.removeChannel(ch); } catch {}
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [Array.isArray(tables) ? tables.join(',') : tables, filter?.value]);
}

/**
 * Subscribe to a specific row's changes.
 */
export function useRealtimeRow<T = any>(table: string, id: string) {
  const [data, setData] = useState<T | null>(null);

  const supabase = createSupabaseBrowserClient();

  useEffect(() => {
    // Initial load
    supabase.from(table).select('*').eq('id', id).single().then(({ data: row }) => {
      setData(row as T);
    });

    // Subscribe
    const channel = supabase
      .channel(`pulse-${table}-${id}`)
      .on('postgres_changes', {
        event: 'UPDATE',
        schema: 'public',
        table,
        filter: `id=eq.${id}`,
      }, (payload) => {
        setData(payload.new as T);
      })
      .subscribe();

    return () => { try { supabase.removeChannel(channel); } catch {} };
  }, [table, id]);

  return data;
}
