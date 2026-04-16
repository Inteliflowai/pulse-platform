/**
 * Alert Dispatcher — sends notifications via email and webhooks.
 *
 * Never blocks the caller — runs asynchronously.
 * Webhook failures are logged but never crash the dispatcher.
 */

import { createAdminSupabaseClient } from '@/lib/supabase/admin';

interface AlertParams {
  tenant_id: string;
  node_id?: string;
  alert_type: string;
  severity: 'info' | 'warning' | 'error' | 'critical';
  message: string;
  metadata?: Record<string, any>;
}

const ALERT_TYPES = [
  'node_offline', 'node_restored', 'storage_high', 'storage_critical',
  'sync_failed', 'sync_recovered', 'jellyfin_unreachable', 'update_available',
  'low_disk', 'backup_failed',
];

export async function dispatchAlert(params: AlertParams): Promise<void> {
  try {
    const supabase = createAdminSupabaseClient();

    // Look up subscribers for this alert type
    const { data: subscriptions } = await supabase
      .from('alert_subscriptions')
      .select('*, users(email, full_name)')
      .eq('tenant_id', params.tenant_id);

    if (!subscriptions || subscriptions.length === 0) return;

    // Get node name if node_id provided
    let nodeName = '';
    let schoolName = '';
    if (params.node_id) {
      const { data: node } = await supabase
        .from('nodes')
        .select('name, sites(name)')
        .eq('id', params.node_id)
        .single();
      nodeName = node?.name ?? '';
      schoolName = (node?.sites as any)?.name ?? '';
    }

    const dashboardUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'https://pulse.inteliflowai.com';

    for (const sub of subscriptions) {
      const alertTypes: string[] = sub.alert_types ?? [];
      if (!alertTypes.includes(params.alert_type)) continue;

      const channels = sub.channels ?? {};
      const userEmail = (sub.users as any)?.email;

      // Email notification
      if (channels.email && userEmail) {
        try {
          // Create in-app notification (visible in cloud admin)
          await supabase.from('notifications').insert({
            tenant_id: params.tenant_id,
            user_id: sub.user_id,
            type: `alert_${params.alert_type}`,
            title: `[${params.severity.toUpperCase()}] ${params.alert_type}${nodeName ? ` — ${nodeName}` : ''}`,
            message: params.message,
            link: params.node_id ? `${dashboardUrl}/dashboard/global/nodes/${params.node_id}` : null,
            metadata: {
              alert_type: params.alert_type,
              severity: params.severity,
              node_id: params.node_id,
              node_name: nodeName,
            },
          });
        } catch (err: any) {
          console.error('[alert-dispatcher] Email notification failed:', err.message);
        }
      }

      // Webhook notification
      if (channels.webhook_url) {
        try {
          await fetch(channels.webhook_url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              alert_type: params.alert_type,
              severity: params.severity,
              message: params.message,
              node_id: params.node_id ?? null,
              node_name: nodeName,
              school_name: schoolName,
              timestamp: new Date().toISOString(),
              dashboard_url: params.node_id
                ? `${dashboardUrl}/dashboard/global/nodes/${params.node_id}`
                : dashboardUrl,
              ...params.metadata,
            }),
            signal: AbortSignal.timeout(5000),
          });
        } catch (err: any) {
          console.error('[alert-dispatcher] Webhook delivery failed:', err.message);
        }
      }
    }
  } catch (err: any) {
    console.error('[alert-dispatcher] Dispatch failed:', err.message);
  }
}
