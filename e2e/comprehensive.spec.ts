import { expect, test } from '@playwright/test';

const E2E_PASSWORD = process.env.E2E_TEST_PASSWORD ?? '';

const ROLES = {
  admin: {
    email: process.env.E2E_ADMIN_EMAIL ?? 'testadmin@example.com',
    password: E2E_PASSWORD,
    home: '/admin/dashboard',
    pages: ['/admin/dashboard', '/admin/clinics', '/admin/payments', '/admin/risk'],
  },
  clinic: {
    email: process.env.E2E_CLINIC_EMAIL ?? 'testclinic@example.com',
    password: E2E_PASSWORD,
    home: '/clinic/dashboard',
    pages: ['/clinic/dashboard', '/clinic/clients', '/clinic/payouts', '/clinic/settings'],
  },
  owner: {
    email: process.env.E2E_OWNER_EMAIL ?? 'testowner@example.com',
    password: E2E_PASSWORD,
    home: '/owner/payments',
    pages: ['/owner/payments', '/owner/enroll', '/owner/settings'],
  },
};

const PUBLIC_PAGES = ['/', '/how-it-works', '/login', '/signup', '/forgot-password'];

test.describe('Comprehensive App Audit', () => {
  test.skip(!process.env.E2E_TEST_PASSWORD, 'E2E_TEST_PASSWORD not set — skipping auth tests');
  test.setTimeout(120000); // 2 minutes per test

  test.beforeEach(async ({ page }) => {
    // Abort requests to monitoring/analytics to prevent networkidle hangs
    await page.route('**/monitoring*', (route) => route.abort());

    page.on('console', (msg) => {
      console.log(`[BROWSER LOG][${msg.type()}] ${msg.text()}`);
    });
    page.on('requestfailed', (request) => {
      // Filter out aborted requests to reduce noise
      if (request.failure()?.errorText !== 'net::ERR_ABORTED') {
        console.log(`[REQUEST FAILED] ${request.url()} - ${request.failure()?.errorText}`);
      }
    });
    page.on('response', (response) => {
      if (response.status() >= 400) {
        console.log(`[RESPONSE ERROR] ${response.status()} ${response.url()}`);
      }
    });
  });

  test('Public pages load correctly', async ({ page }) => {
    for (const path of PUBLIC_PAGES) {
      console.log(`Testing public page: ${path}`);
      const response = await page.goto(path, { waitUntil: 'domcontentloaded', timeout: 30000 });
      expect(response?.ok()).toBeTruthy();
      await expect(page.locator('body')).toBeVisible();
    }
  });

  for (const [role, config] of Object.entries(ROLES)) {
    test(`Role: ${role} can login and access pages`, async ({ page }) => {
      console.log(`Starting audit for role: ${role}`);

      // 1. Login
      await page.goto('/login', { waitUntil: 'domcontentloaded' });

      // Wait for React hydration so the form's onSubmit handler is attached
      await page.waitForSelector('button[type="submit"]:not([disabled])');

      await page.fill('#email', config.email);
      await page.fill('#password', config.password);

      console.log(`[${role}] Clicking submit...`);

      // Attempt login and handle potential failure
      try {
        await Promise.all([
          page.waitForURL(new RegExp(config.home), {
            timeout: 15000,
            waitUntil: 'domcontentloaded',
          }),
          page.click('button[type="submit"]'),
        ]);
      } catch (e) {
        console.log(`[${role}] Login redirect failed or timed out.`);
        console.log(`[${role}] Current URL: ${page.url()}`);

        // Check for visible error messages
        const errorMsg = await page
          .locator('.text-destructive')
          .textContent()
          .catch(() => null);
        if (errorMsg) {
          console.log(`[${role}] Login Error Message: ${errorMsg}`);
        }

        throw e;
      }

      console.log(`[${role}] Login successful, current URL: ${page.url()}`);

      // 2. Visit all role pages
      for (const path of config.pages) {
        console.log(`[${role}] Visiting: ${path}`);
        const response = await page.goto(path, { waitUntil: 'domcontentloaded', timeout: 30000 });
        expect(response?.ok()).toBeTruthy();
        await expect(page.locator('body')).toBeVisible();

        await expect(page.getByText('404')).not.toBeVisible();
        await expect(page.getByText('Unauthorized')).not.toBeVisible();
      }
    });
  }
});
