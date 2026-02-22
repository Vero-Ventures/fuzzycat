import { expect, test } from '@playwright/test';

// baseURL is https://fuzzycatapp.com (configured in playwright.config.ts for production-public project)

test.describe('Production public pages', () => {
  test('landing page loads', async ({ page }) => {
    const response = await page.goto('/');
    expect(response?.status()).toBe(200);

    await expect(page.locator('h1')).toContainText(/fuzzycat|vet|pet/i);
  });

  test('how-it-works page loads', async ({ page }) => {
    const response = await page.goto('/how-it-works');
    expect(response?.status()).toBe(200);
  });

  test('login page loads', async ({ page }) => {
    await page.goto('/login');

    // Login form should render
    await expect(page.locator('input[type="email"]')).toBeVisible();
    await expect(page.locator('input[type="password"]')).toBeVisible();
  });

  test('signup page loads', async ({ page }) => {
    await page.goto('/signup');

    // Signup form should render
    await expect(page.locator('input[type="email"]')).toBeVisible();
    await expect(page.locator('input[type="password"]')).toBeVisible();
  });

  test('health endpoint responds', async ({ request }) => {
    const response = await request.get('/api/health');
    expect([200, 503]).toContain(response.status());

    const body = await response.json();
    expect(body).toHaveProperty('status');
    expect(['ok', 'degraded']).toContain(body.status);
  });

  test('has no critical console errors', async ({ page }) => {
    const errors: string[] = [];
    page.on('console', (msg) => {
      if (msg.type() === 'error') errors.push(msg.text());
    });

    await page.goto('/', { waitUntil: 'load' });

    // Filter out known third-party errors
    const realErrors = errors.filter(
      (e) =>
        !e.includes('posthog') &&
        !e.includes('sentry') &&
        !e.includes('favicon') &&
        !e.includes('monitoring'),
    );
    expect(realErrors).toHaveLength(0);
  });

  test('captures screenshots of each page', async ({ page }, testInfo) => {
    const pages = [
      { url: '/', name: 'prod-landing' },
      { url: '/how-it-works', name: 'prod-how-it-works' },
      { url: '/login', name: 'prod-login' },
      { url: '/signup', name: 'prod-signup' },
    ];

    for (const { url, name } of pages) {
      await page.goto(url);
      await page.waitForLoadState('domcontentloaded');
      await testInfo.attach(name, {
        body: await page.screenshot({ fullPage: true }),
        contentType: 'image/png',
      });
    }
  });
});
