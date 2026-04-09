/**
 * Asset deduplication: checks if an identical file already exists
 * by comparing SHA-256 checksum before uploading.
 */

import { SupabaseClient } from '@supabase/supabase-js';

export async function findDuplicateAsset(
  supabase: SupabaseClient,
  checksum: string,
  tenantId: string
): Promise<{ isDuplicate: boolean; existingAssetId?: string; existingFilename?: string }> {
  const { data } = await supabase
    .from('assets')
    .select('id, filename')
    .eq('tenant_id', tenantId)
    .eq('checksum', checksum)
    .eq('status', 'ready')
    .limit(1);

  if (data && data.length > 0) {
    return {
      isDuplicate: true,
      existingAssetId: data[0].id,
      existingFilename: data[0].filename,
    };
  }

  return { isDuplicate: false };
}

export async function computeFileChecksum(file: File): Promise<string> {
  const buffer = await file.arrayBuffer();
  const hashBuffer = await crypto.subtle.digest('SHA-256', buffer);
  return Array.from(new Uint8Array(hashBuffer))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}
