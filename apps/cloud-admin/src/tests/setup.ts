/**
 * Vitest setup file for cloud-admin tests.
 * Configures environment variables and mocks before each test.
 */
import { beforeEach, vi } from 'vitest';
import { resetMockData, createMockSupabaseClient } from './mocks/supabase';

// ── Test environment variables ───────────────────────────────────

process.env.NEXT_PUBLIC_SUPABASE_URL = 'http://localhost:54321';
process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = 'test-anon-key';
process.env.SUPABASE_SERVICE_ROLE_KEY = 'test-service-role-key';
process.env.INTERNAL_API_SECRET = 'test-secret';
process.env.PULSE_NODE_SECRET = 'test-pulse-secret';
process.env.NODE_ENV = 'test';

// ── Expose mock factory on globalThis so vi.mock factories can access it ──

(globalThis as any).__createMockSupabaseClient = createMockSupabaseClient;

// ── Mock Next.js modules ─────────────────────────────────────────

vi.mock('next/server', () => {
  class MockNextRequest {
    public url: string;
    public method: string;
    private _body: any;
    private _headersMap: Map<string, string>;
    public headers: { get: (name: string) => string | null };

    constructor(url: string, init?: { method?: string; body?: string; headers?: Record<string, string> }) {
      this.url = url;
      this.method = init?.method ?? 'GET';
      this._body = init?.body ? JSON.parse(init.body) : null;
      this._headersMap = new Map(
        Object.entries(init?.headers ?? {}).map(([k, v]) => [k.toLowerCase(), v])
      );
      this.headers = {
        get: (name: string) => this._headersMap.get(name.toLowerCase()) ?? null,
      };
    }

    json() {
      return Promise.resolve(this._body);
    }

    get nextUrl() {
      return new URL(this.url);
    }
  }

  class MockNextResponse {
    static json(body: any, init?: { status?: number }) {
      return {
        status: init?.status ?? 200,
        body,
        async json() { return body; },
      };
    }
  }

  return {
    NextRequest: MockNextRequest,
    NextResponse: MockNextResponse,
  };
});

vi.mock('next/headers', () => ({
  cookies: () => ({
    getAll: () => [],
    set: () => {},
  }),
}));

// ── Mock Supabase ────────────────────────────────────────────────

vi.mock('@supabase/supabase-js', () => ({
  createClient: () => (globalThis as any).__createMockSupabaseClient(),
}));

vi.mock('@/lib/supabase/admin', () => ({
  createAdminSupabaseClient: () => (globalThis as any).__createMockSupabaseClient(),
}));

vi.mock('@/lib/supabase/server', () => ({
  createSupabaseServerClient: async () => (globalThis as any).__createMockSupabaseClient(),
}));

vi.mock('@/lib/supabase/browser', () => ({
  createSupabaseBrowserClient: () => (globalThis as any).__createMockSupabaseClient(),
}));

vi.mock('@supabase/ssr', () => ({
  createServerClient: () => (globalThis as any).__createMockSupabaseClient(),
  createBrowserClient: () => (globalThis as any).__createMockSupabaseClient(),
}));

// ── Reset state between tests ────────────────────────────────────

beforeEach(() => {
  resetMockData();
  vi.clearAllMocks();
});
