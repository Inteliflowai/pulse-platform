/**
 * SPARK Integration — Interactive Media & Experiments
 *
 * SPARK assets (HTML5 interactives, simulations) are delivered as
 * sequence items of type 'interactive'. They run in an iframe on the
 * classroom player and communicate results via postMessage.
 */

import { log } from '../logger';

const CLOUD_API_URL = process.env.CLOUD_API_URL ?? '';

interface SparkAsset {
  external_id: string;
  title: string;
  asset_url: string;  // URL to the interactive HTML bundle
  grade_id?: string;
  subject_id?: string;
  duration_minutes?: number;
}

export async function importSparkAsset(payload: SparkAsset): Promise<string | null> {
  try {
    // SPARK interactives are treated as assets with type 'interactive'
    // They get synced via the normal package flow and served locally
    log('info', 'SPARK asset import requested', { external_id: payload.external_id, title: payload.title });

    // In production: download the HTML bundle, create an asset record,
    // add to a package, and sync to nodes. The classroom player renders
    // interactives in an iframe with postMessage for result reporting.

    return payload.external_id;
  } catch (err: any) {
    log('error', 'SPARK integration error', { error: err.message });
    return null;
  }
}

export async function reportSparkCompletion(
  studentId: string,
  assetId: string,
  score: number,
  maxScore: number,
  metadata: Record<string, unknown>
): Promise<void> {
  try {
    await fetch(`${CLOUD_API_URL}/api/progress`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        progress_records: [{
          id: crypto.randomUUID(),
          student_id: studentId,
          sequence_item_id: assetId,
          status: 'completed',
          completed_at: new Date().toISOString(),
          metadata: { spark_score: score, spark_max_score: maxScore, ...metadata },
        }],
      }),
    });
    log('info', 'SPARK completion reported', { student_id: studentId, asset_id: assetId });
  } catch (err: any) {
    log('warning', 'Failed to report SPARK completion', { error: err.message });
  }
}
