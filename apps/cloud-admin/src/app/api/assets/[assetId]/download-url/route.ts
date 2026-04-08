import { NextRequest, NextResponse } from 'next/server';
import { createAdminSupabaseClient } from '@/lib/supabase/admin';

// Simple in-memory rate limiter: 100 calls/min per node
const rateLimitMap = new Map<string, { count: number; resetAt: number }>();

function checkRateLimit(nodeId: string): boolean {
  const now = Date.now();
  const entry = rateLimitMap.get(nodeId);

  if (!entry || now > entry.resetAt) {
    rateLimitMap.set(nodeId, { count: 1, resetAt: now + 60_000 });
    return true;
  }

  if (entry.count >= 100) return false;
  entry.count++;
  return true;
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ assetId: string }> }
) {
  const { assetId } = await params;
  const supabase = createAdminSupabaseClient();

  // Auth: node token or user session
  const nodeToken = request.headers.get('x-node-token');
  let nodeId: string | null = null;

  if (nodeToken) {
    // Validate node by registration token
    const { data: node } = await supabase
      .from('nodes')
      .select('id')
      .eq('registration_token', nodeToken)
      .eq('status', 'active')
      .single();

    if (!node) {
      return NextResponse.json({ error: 'Invalid node token' }, { status: 401 });
    }
    nodeId = node.id;

    // Rate limit
    if (!checkRateLimit(nodeId!)) {
      return NextResponse.json({ error: 'Rate limit exceeded' }, { status: 429 });
    }

    // Validate node has an active sync_job for a package containing this asset
    const { data: validJob } = await supabase
      .from('sync_jobs')
      .select('id, package_id')
      .eq('node_id', nodeId)
      .in('status', ['pending', 'in_progress'])
      .limit(100);

    if (!validJob || validJob.length === 0) {
      return NextResponse.json({ error: 'No active sync job for this node' }, { status: 403 });
    }

    const packageIds = validJob.map((j) => j.package_id);
    const { data: packageAsset } = await supabase
      .from('package_assets')
      .select('id')
      .eq('asset_id', assetId)
      .in('package_id', packageIds)
      .limit(1);

    if (!packageAsset || packageAsset.length === 0) {
      return NextResponse.json({ error: 'Asset not part of any active sync job' }, { status: 403 });
    }
  } else {
    // Fallback: service role key header
    const secret = request.headers.get('x-node-secret');
    if (!secret || secret !== process.env.SUPABASE_SERVICE_ROLE_KEY) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
  }

  // Get asset storage path
  const { data: asset } = await supabase
    .from('assets')
    .select('storage_path, status')
    .eq('id', assetId)
    .single();

  if (!asset) {
    return NextResponse.json({ error: 'Asset not found' }, { status: 404 });
  }

  if (asset.status !== 'ready') {
    return NextResponse.json({ error: 'Asset is not ready for download' }, { status: 400 });
  }

  // Generate signed URL (3 hour expiry)
  const { data: signedUrl, error: signErr } = await supabase.storage
    .from('pulse-assets')
    .createSignedUrl(asset.storage_path, 3 * 60 * 60);

  if (signErr || !signedUrl) {
    return NextResponse.json({ error: 'Failed to generate download URL' }, { status: 500 });
  }

  const expiresAt = new Date(Date.now() + 3 * 60 * 60 * 1000).toISOString();

  return NextResponse.json({ url: signedUrl.signedUrl, expires_at: expiresAt });
}
