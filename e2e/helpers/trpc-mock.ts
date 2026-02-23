import type { Page } from '@playwright/test';

/**
 * Registry-based tRPC mock system for Playwright E2E tests.
 *
 * Solves two bugs in the previous per-route mock approach:
 *
 * 1. **Route ordering**: Playwright matches routes in LIFO (reverse registration)
 *    order. The old `mockAllTrpc()` catch-all was registered last, so it was
 *    checked first and overrode all specific mocks with null data.
 *
 * 2. **Batch requests**: tRPC's `httpBatchLink` combines multiple queries into
 *    a single HTTP request (e.g. `/api/trpc/a,b,c?batch=1&input=...`). The old
 *    per-procedure route handlers returned a single-element array for a batched
 *    request that expected multiple results, causing all but the first procedure
 *    in the batch to receive undefined data.
 *
 * This new approach uses a per-page registry (WeakMap keyed by Page) to store
 * mock data, and a single page.route handler matching all /api/trpc/ URLs that
 * parses procedure names from the URL and returns the correct number of results.
 */

/**
 * Wrap response data in the superjson envelope expected by the tRPC client.
 * The tRPC client is configured with `transformer: superjson` (see lib/trpc/provider.tsx),
 * so all successful responses must use the `{ json: data }` wire format.
 */
function superjsonResult(data: unknown) {
  return { result: { data: { json: data } } };
}

type MockEntry =
  | { type: 'data'; data: unknown; delayMs?: number }
  | { type: 'error'; errorCode: string; message: string; procedure: string };

type MutationMockEntry =
  | { type: 'data'; data: unknown }
  | { type: 'error'; errorCode: string; message: string; procedure: string };

const queryMocks = new WeakMap<Page, Map<string, MockEntry>>();
const mutationMocks = new WeakMap<Page, Map<string, MutationMockEntry>>();
const routeInstalled = new WeakMap<Page, boolean>();

function getQueryRegistry(page: Page): Map<string, MockEntry> {
  let registry = queryMocks.get(page);
  if (!registry) {
    registry = new Map();
    queryMocks.set(page, registry);
  }
  return registry;
}

function getMutationRegistry(page: Page): Map<string, MutationMockEntry> {
  let registry = mutationMocks.get(page);
  if (!registry) {
    registry = new Map();
    mutationMocks.set(page, registry);
  }
  return registry;
}

/**
 * Build a single tRPC result entry from a mock registry entry.
 * Returns a default superjson-wrapped null for unmocked procedures.
 */
function buildQueryResult(entry: MockEntry | undefined): unknown {
  if (!entry) {
    return superjsonResult(null);
  }
  if (entry.type === 'error') {
    return {
      error: {
        message: entry.message,
        code: -32603,
        data: { code: entry.errorCode, httpStatus: 500, path: entry.procedure },
      },
    };
  }
  return superjsonResult(entry.data);
}

function buildMutationResult(entry: MutationMockEntry | undefined): unknown {
  if (!entry) {
    return superjsonResult({ success: true });
  }
  if (entry.type === 'error') {
    return {
      error: {
        message: entry.message,
        code: -32603,
        data: { code: entry.errorCode, httpStatus: 500, path: entry.procedure },
      },
    };
  }
  return superjsonResult(entry.data);
}

/**
 * Extract procedure names from a tRPC URL.
 *
 * Handles both single and batched request URLs:
 * - Single: /api/trpc/owner.getPlans?input=...
 * - Batched: /api/trpc/owner.getDashboardSummary,owner.getPlans?batch=1&input=...
 */
function parseProcedures(url: string): string[] {
  const match = url.match(/\/api\/trpc\/([^?]+)/);
  if (!match) return [];
  return match[1].split(',');
}

/**
 * Install the single route handler that serves all tRPC mocks for a page.
 * Called automatically on first mock registration. Safe to call multiple times.
 */
async function ensureRouteInstalled(page: Page): Promise<void> {
  if (routeInstalled.get(page)) return;
  routeInstalled.set(page, true);

  await page.route('**/api/trpc/**', async (route, request) => {
    const url = request.url();
    const procedures = parseProcedures(url);

    if (request.method() === 'GET') {
      const registry = getQueryRegistry(page);

      // Check if any procedure in the batch has a delay
      const maxDelay = procedures.reduce((max, proc) => {
        const entry = registry.get(proc);
        if (entry?.type === 'data' && entry.delayMs) {
          return Math.max(max, entry.delayMs);
        }
        return max;
      }, 0);

      if (maxDelay > 0) {
        await new Promise((resolve) => setTimeout(resolve, maxDelay));
      }

      const results = procedures.map((proc) => buildQueryResult(registry.get(proc)));

      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(results),
      });
    } else if (request.method() === 'POST') {
      const registry = getMutationRegistry(page);
      const results = procedures.map((proc) => buildMutationResult(registry.get(proc)));

      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(results),
      });
    } else {
      await route.fallback();
    }
  });
}

/**
 * Register a mock response for a tRPC query procedure.
 * Automatically installs the route handler on first call.
 */
export async function mockTrpcQuery(
  page: Page,
  procedure: string,
  response: unknown,
): Promise<void> {
  getQueryRegistry(page).set(procedure, { type: 'data', data: response });
  await ensureRouteInstalled(page);
}

/**
 * Register a mock response for a tRPC mutation procedure.
 * Automatically installs the route handler on first call.
 */
export async function mockTrpcMutation(
  page: Page,
  procedure: string,
  response: unknown,
): Promise<void> {
  getMutationRegistry(page).set(procedure, { type: 'data', data: response });
  await ensureRouteInstalled(page);
}

/**
 * Register a mock error response for a tRPC query procedure.
 */
export async function mockTrpcQueryError(
  page: Page,
  procedure: string,
  errorCode: string,
  message: string,
): Promise<void> {
  getQueryRegistry(page).set(procedure, { type: 'error', errorCode, message, procedure });
  await ensureRouteInstalled(page);
}

/**
 * Register a mock error response for a tRPC mutation procedure.
 */
export async function mockTrpcMutationError(
  page: Page,
  procedure: string,
  errorCode: string,
  message: string,
): Promise<void> {
  getMutationRegistry(page).set(procedure, { type: 'error', errorCode, message, procedure });
  await ensureRouteInstalled(page);
}

/**
 * Register a mock empty response for a tRPC query procedure.
 */
export async function mockTrpcQueryEmpty(
  page: Page,
  procedure: string,
  emptyValue: unknown = null,
): Promise<void> {
  await mockTrpcQuery(page, procedure, emptyValue);
}

/**
 * Register a mock delayed response for a tRPC query procedure.
 */
export async function mockTrpcQueryDelayed(
  page: Page,
  procedure: string,
  data: unknown,
  delayMs: number,
): Promise<void> {
  getQueryRegistry(page).set(procedure, { type: 'data', data, delayMs });
  await ensureRouteInstalled(page);
}

/**
 * Ensure the tRPC route handler is installed for the given page.
 * Exported for `mockAllTrpc()` in portal-test-base.ts.
 * Prefer using `mockTrpcQuery()` etc. which call this automatically.
 */
export { ensureRouteInstalled as _ensureRouteInstalled };
