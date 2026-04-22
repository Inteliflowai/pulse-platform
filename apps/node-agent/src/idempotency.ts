/**
 * Minimal idempotency helper for mutating endpoints.
 *
 * Clients send an `Idempotency-Key` header (or `idempotency_key` in the JSON body).
 * The first request runs the handler and the JSON response is cached for TTL_MS.
 * Any repeated request with the same (route, key) returns the cached response
 * without re-executing the handler.
 *
 * In-memory only: good enough for a single-process node-agent; a reverse proxy
 * or multi-node cloud deployment would need Redis or similar.
 */

import type { Request, Response, NextFunction } from 'express';

const TTL_MS = 10 * 60 * 1000;
const MAX_ENTRIES = 1000;

interface CachedResponse {
  status: number;
  body: any;
  expiresAt: number;
}

const cache = new Map<string, CachedResponse>();

function gc() {
  const now = Date.now();
  for (const [k, v] of cache) {
    if (v.expiresAt <= now) cache.delete(k);
  }
  // Hard cap — evict oldest insertions first if we blew past the size limit.
  while (cache.size > MAX_ENTRIES) {
    const oldest = cache.keys().next().value;
    if (!oldest) break;
    cache.delete(oldest);
  }
}

export function idempotent(route: string) {
  return function (req: Request, res: Response, next: NextFunction) {
    const key =
      (req.header('idempotency-key') ?? '') ||
      (typeof req.body?.idempotency_key === 'string' ? req.body.idempotency_key : '');

    if (!key) { next(); return; }

    const cacheKey = `${route}:${key}`;
    const hit = cache.get(cacheKey);
    if (hit && hit.expiresAt > Date.now()) {
      res.status(hit.status).json(hit.body);
      return;
    }

    // Intercept res.json so we can cache the first successful response.
    const originalJson = res.json.bind(res);
    (res as any).json = (body: any) => {
      if (res.statusCode >= 200 && res.statusCode < 300) {
        cache.set(cacheKey, { status: res.statusCode, body, expiresAt: Date.now() + TTL_MS });
        gc();
      }
      return originalJson(body);
    };

    next();
  };
}
