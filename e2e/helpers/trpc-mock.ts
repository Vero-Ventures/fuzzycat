import type { Page } from '@playwright/test';

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
        body: JSON.stringify([{ result: { data: response } }]),
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
        body: JSON.stringify([{ result: { data: response } }]),
      });
    } else {
      await route.fallback();
    }
  });
}
