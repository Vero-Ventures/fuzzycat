import type { Page } from '@playwright/test';

/**
 * Wrap response data in the superjson envelope expected by the tRPC client.
 * The tRPC client is configured with `transformer: superjson` (see lib/trpc/provider.tsx),
 * so all successful responses must use the `{ json: data }` wire format.
 */
function superjsonResult(data: unknown) {
  return { result: { data: { json: data } } };
}

/**
 * Intercepts a tRPC query and returns a mock response.
 * Matches GET requests to /api/trpc/<procedure>
 */
export async function mockTrpcQuery(page: Page, procedure: string, response: unknown) {
  await page.route(`**/api/trpc/${procedure}*`, async (route, request) => {
    if (request.method() === 'GET') {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify([superjsonResult(response)]),
      });
    } else {
      await route.fallback();
    }
  });
}

/**
 * Intercepts a tRPC mutation and returns a mock response.
 * Matches POST requests to /api/trpc/<procedure>
 */
export async function mockTrpcMutation(page: Page, procedure: string, response: unknown) {
  await page.route(`**/api/trpc/${procedure}*`, async (route, request) => {
    if (request.method() === 'POST') {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify([superjsonResult(response)]),
      });
    } else {
      await route.fallback();
    }
  });
}

/**
 * Intercepts a tRPC query and returns a tRPC-formatted error response.
 */
export async function mockTrpcQueryError(
  page: Page,
  procedure: string,
  errorCode: string,
  message: string,
) {
  await page.route(`**/api/trpc/${procedure}*`, async (route, request) => {
    if (request.method() === 'GET') {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify([
          {
            error: {
              message,
              code: -32603,
              data: { code: errorCode, httpStatus: 500, path: procedure },
            },
          },
        ]),
      });
    } else {
      await route.fallback();
    }
  });
}

/**
 * Intercepts a tRPC mutation and returns a tRPC-formatted error response.
 */
export async function mockTrpcMutationError(
  page: Page,
  procedure: string,
  errorCode: string,
  message: string,
) {
  await page.route(`**/api/trpc/${procedure}*`, async (route, request) => {
    if (request.method() === 'POST') {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify([
          {
            error: {
              message,
              code: -32603,
              data: { code: errorCode, httpStatus: 500, path: procedure },
            },
          },
        ]),
      });
    } else {
      await route.fallback();
    }
  });
}

/**
 * Intercepts a tRPC query and returns empty data (null, [], or {}).
 */
export async function mockTrpcQueryEmpty(
  page: Page,
  procedure: string,
  emptyValue: unknown = null,
) {
  await mockTrpcQuery(page, procedure, emptyValue);
}

/**
 * Intercepts a tRPC query and returns data after a simulated delay.
 */
export async function mockTrpcQueryDelayed(
  page: Page,
  procedure: string,
  data: unknown,
  delayMs: number,
) {
  await page.route(`**/api/trpc/${procedure}*`, async (route, request) => {
    if (request.method() === 'GET') {
      await new Promise((resolve) => setTimeout(resolve, delayMs));
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify([superjsonResult(data)]),
      });
    } else {
      await route.fallback();
    }
  });
}
