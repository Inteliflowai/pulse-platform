/**
 * Central Supabase mock for testing.
 * Intercepts all Supabase client calls and returns controllable test data.
 */
import { vi } from 'vitest';

// ── Mock data store ──────────────────────────────────────────────

export const mockSupabaseData: Record<string, any[]> = {
  nodes: [],
  tenants: [],
  sites: [],
  users: [],
  packages: [],
  assets: [],
  sync_jobs: [],
  classrooms: [],
  devices: [],
  node_events: [],
  node_metrics: [],
  audit_logs: [],
  pulse_quiz_results: [],
  package_assets: [],
  notifications: [],
  product_licenses: [],
  tenant_integration_credentials: [],
};

export function resetMockData() {
  Object.keys(mockSupabaseData).forEach((k) => {
    mockSupabaseData[k] = [];
  });
}

export function seedMockData(overrides: Partial<typeof mockSupabaseData>) {
  Object.entries(overrides).forEach(([k, v]) => {
    if (v) mockSupabaseData[k] = [...v];
  });
}

// ── Chainable query builder mock ─────────────────────────────────

type FilterOp = { col: string; op: string; val: any };

function createQueryBuilder(table: string, initialData?: any[]) {
  let filters: FilterOp[] = [];
  let orderCol: string | null = null;
  let orderAsc = true;
  let limitN: number | null = null;
  let selectCols: string | null = null;
  let insertedData: any = null;
  let updatedData: any = null;
  let isDelete = false;
  let isSingle = false;
  let isMaybeSingle = false;
  let doSelect = false;

  function applyFilters(data: any[]): any[] {
    let result = [...data];
    for (const f of filters) {
      switch (f.op) {
        case 'eq':
          result = result.filter((r) => r[f.col] === f.val);
          break;
        case 'neq':
          result = result.filter((r) => r[f.col] !== f.val);
          break;
        case 'in':
          result = result.filter((r) => (f.val as any[]).includes(r[f.col]));
          break;
        case 'lt':
          result = result.filter((r) => r[f.col] < f.val);
          break;
        case 'gt':
          result = result.filter((r) => r[f.col] > f.val);
          break;
        case 'lte':
          result = result.filter((r) => r[f.col] <= f.val);
          break;
        case 'gte':
          result = result.filter((r) => r[f.col] >= f.val);
          break;
        case 'not-null':
          result = result.filter((r) => r[f.col] !== null && r[f.col] !== undefined);
          break;
        case 'match':
          result = result.filter((r) => (f.val as RegExp).test(String(r[f.col] ?? '')));
          break;
      }
    }
    return result;
  }

  const builder: any = {
    select(cols?: string) {
      selectCols = cols ?? '*';
      doSelect = true;
      return builder;
    },
    insert(data: any) {
      insertedData = Array.isArray(data) ? data : [data];
      // Actually insert into mock store
      for (const item of insertedData) {
        if (!item.id) item.id = `mock-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
        mockSupabaseData[table].push({ ...item });
      }
      return builder;
    },
    upsert(data: any, opts?: { onConflict?: string }) {
      // onConflict may be a comma-separated list of columns. We match on all of them.
      const conflictCols = (opts?.onConflict ?? 'id').split(',').map((c) => c.trim());
      const rows = Array.isArray(data) ? data : [data];
      insertedData = [];
      for (const row of rows) {
        const existing = mockSupabaseData[table].find((r) =>
          conflictCols.every((c) => r[c] === row[c])
        );
        if (existing) {
          Object.assign(existing, row);
          insertedData.push(existing);
        } else {
          const toInsert = { ...row };
          if (!toInsert.id) toInsert.id = `mock-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
          mockSupabaseData[table].push(toInsert);
          insertedData.push(toInsert);
        }
      }
      return builder;
    },
    update(data: any) {
      updatedData = data;
      return builder;
    },
    delete() {
      isDelete = true;
      return builder;
    },
    eq(col: string, val: any) {
      filters.push({ col, op: 'eq', val });
      return builder;
    },
    neq(col: string, val: any) {
      filters.push({ col, op: 'neq', val });
      return builder;
    },
    in(col: string, vals: any[]) {
      filters.push({ col, op: 'in', val: vals });
      return builder;
    },
    lt(col: string, val: any) {
      filters.push({ col, op: 'lt', val });
      return builder;
    },
    gt(col: string, val: any) {
      filters.push({ col, op: 'gt', val });
      return builder;
    },
    lte(col: string, val: any) {
      filters.push({ col, op: 'lte', val });
      return builder;
    },
    gte(col: string, val: any) {
      filters.push({ col, op: 'gte', val });
      return builder;
    },
    // .not('col', 'is', null) → rows where col is not null.
    not(col: string, op: string, val: any) {
      if (op === 'is' && val === null) {
        filters.push({ col, op: 'not-null', val: null });
      } else if (op === 'eq') {
        filters.push({ col, op: 'neq', val });
      }
      return builder;
    },
    ilike(col: string, pattern: string) {
      // Basic ILIKE: % → .*, case-insensitive match.
      const rx = new RegExp('^' + pattern.replace(/%/g, '.*') + '$', 'i');
      filters.push({ col, op: 'match', val: rx });
      return builder;
    },
    order(col: string, opts?: { ascending?: boolean }) {
      orderCol = col;
      orderAsc = opts?.ascending ?? true;
      return builder;
    },
    limit(n: number) {
      limitN = n;
      return builder;
    },
    single() {
      isSingle = true;
      return resolve();
    },
    maybeSingle() {
      isMaybeSingle = true;
      return resolve();
    },
    then(onFulfilled: any, onRejected?: any) {
      return resolve().then(onFulfilled, onRejected);
    },
  };

  function resolve(): Promise<{ data: any; error: any }> {
    // Handle update
    if (updatedData) {
      const matches = applyFilters(mockSupabaseData[table]);
      for (const match of matches) {
        Object.assign(match, updatedData);
      }
      if (doSelect) {
        if (isSingle) {
          return Promise.resolve({
            data: matches[0] ?? null,
            error: matches.length === 0 ? { message: 'No rows found', code: 'PGRST116' } : null,
          });
        }
        return Promise.resolve({ data: matches, error: null });
      }
      return Promise.resolve({ data: null, error: null });
    }

    // Handle delete
    if (isDelete) {
      const before = mockSupabaseData[table].length;
      const matches = applyFilters(mockSupabaseData[table]);
      const matchIds = new Set(matches.map((m) => JSON.stringify(m)));
      mockSupabaseData[table] = mockSupabaseData[table].filter(
        (r) => !matchIds.has(JSON.stringify(r))
      );
      return Promise.resolve({ data: null, error: null });
    }

    // Handle insert (already pushed to store)
    if (insertedData) {
      if (doSelect) {
        if (isSingle) {
          return Promise.resolve({ data: insertedData[0], error: null });
        }
        return Promise.resolve({ data: insertedData, error: null });
      }
      return Promise.resolve({ data: insertedData, error: null });
    }

    // Handle select
    let data = applyFilters(mockSupabaseData[table]);

    if (orderCol) {
      data.sort((a, b) => {
        const av = a[orderCol!];
        const bv = b[orderCol!];
        return orderAsc ? (av > bv ? 1 : -1) : (av < bv ? 1 : -1);
      });
    }

    if (limitN != null) {
      data = data.slice(0, limitN);
    }

    if (isSingle) {
      if (data.length === 0) {
        return Promise.resolve({ data: null, error: { message: 'No rows found', code: 'PGRST116' } });
      }
      return Promise.resolve({ data: data[0], error: null });
    }

    if (isMaybeSingle) {
      return Promise.resolve({ data: data[0] ?? null, error: null });
    }

    return Promise.resolve({ data, error: null });
  }

  return builder;
}

// ── Storage mock ─────────────────────────────────────────────────

const storageMock = {
  from(bucket: string) {
    return {
      createSignedUrl(path: string, expiresIn: number) {
        return Promise.resolve({
          data: { signedUrl: `https://mock-storage.test/${bucket}/${path}?token=mock&expires=${expiresIn}` },
          error: null,
        });
      },
      upload(path: string, body: any) {
        return Promise.resolve({ data: { path }, error: null });
      },
      download(path: string) {
        return Promise.resolve({ data: new Blob(), error: null });
      },
    };
  },
};

// ── Client mock ──────────────────────────────────────────────────

export function createMockSupabaseClient() {
  return {
    from(table: string) {
      if (!(table in mockSupabaseData)) {
        // Auto-create table in mock store
        mockSupabaseData[table] = [];
      }
      return createQueryBuilder(table);
    },
    storage: storageMock,
    auth: {
      admin: {
        createUser: vi.fn().mockResolvedValue({ data: { user: { id: 'mock-user-id' } }, error: null }),
        generateLink: vi.fn().mockResolvedValue({
          data: { properties: { action_link: 'https://mock.test/link' } },
          error: null,
        }),
      },
      getUser: vi.fn().mockResolvedValue({ data: { user: { id: 'mock-user-id' } }, error: null }),
    },
  };
}

// Note: vi.mock calls are in setup.ts — not here.
// This module only exports data helpers and the mock client factory.
