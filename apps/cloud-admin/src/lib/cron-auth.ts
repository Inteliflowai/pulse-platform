import { NextRequest } from 'next/server';

function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

export function isCronAuthorized(request: NextRequest): boolean {
  const expected = process.env.CRON_SECRET;
  if (!expected) return false;

  const header = request.headers.get('x-cron-secret') ?? '';
  if (header && timingSafeEqual(header, expected)) return true;

  const auth = request.headers.get('authorization') ?? '';
  if (auth.startsWith('Bearer ') && timingSafeEqual(auth.slice(7), expected)) return true;

  return false;
}
