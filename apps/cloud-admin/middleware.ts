import { type NextRequest, NextResponse } from 'next/server';
import { updateSession } from '@/lib/supabase/middleware';

// Simple in-memory rate limiter for middleware
const apiRateMap = new Map<string, { count: number; resetAt: number }>();

function checkApiRate(ip: string): boolean {
  const now = Date.now();
  const entry = apiRateMap.get(ip);
  if (!entry || now > entry.resetAt) {
    apiRateMap.set(ip, { count: 1, resetAt: now + 60_000 });
    return true;
  }
  if (entry.count >= 120) return false; // 120 req/min per IP for API routes
  entry.count++;
  return true;
}

export async function middleware(request: NextRequest) {
  const path = request.nextUrl.pathname;

  // Rate limit API routes
  if (path.startsWith('/api/')) {
    const ip = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? request.headers.get('x-real-ip') ?? 'unknown';
    if (!checkApiRate(ip)) {
      return NextResponse.json({ error: 'Rate limit exceeded' }, { status: 429 });
    }
  }

  // Auth session for dashboard routes
  if (path.startsWith('/dashboard')) {
    return await updateSession(request);
  }

  return NextResponse.next();
}

export const config = {
  matcher: ['/dashboard/:path*', '/api/:path*'],
};
