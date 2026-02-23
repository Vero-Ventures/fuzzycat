import { expect, test } from '@playwright/test';
import { takeScreenshot } from '../../helpers/screenshot';

const SUBDIR = 'auth';

/** Block Turnstile + analytics to prevent networkidle hangs. */
async function mockExternalServices(page: import('@playwright/test').Page) {
  await page.route('**/challenges.cloudflare.com/**', (route) =>
    route.fulfill({
      status: 200,
      contentType: 'application/javascript',
      body: 'window.turnstile = { render: function(el, opts) { if (opts && opts.callback) opts.callback("mock-token"); return "mock-id"; }, reset: function() {}, remove: function() {} };',
    }),
  );
  await page.route('**/us.i.posthog.com/**', (route) => route.fulfill({ status: 200, body: '{}' }));
  await page.route('**/*.ingest.sentry.io/**', (route) =>
    route.fulfill({ status: 200, body: '{}' }),
  );
  await page.route('**/browser.sentry-cdn.com/**', (route) =>
    route.fulfill({ status: 200, contentType: 'application/javascript', body: '' }),
  );
}

test.describe('UI Audit: Auth Pages', () => {
  test('Login page — email/password form', async ({ page }, testInfo) => {
    await mockExternalServices(page);

    await page.goto('/login');

    await expect(page.getByRole('heading', { name: /log in/i })).toBeVisible({ timeout: 10000 });
    await expect(page.locator('input[type="email"]')).toBeVisible();
    await expect(page.locator('input[type="password"]')).toBeVisible();
    await expect(page.getByRole('button', { name: /log in|sign in|submit/i })).toBeVisible();

    await takeScreenshot(page, testInfo, 'login-form', SUBDIR);
  });

  test('Signup page — registration form + role selection', async ({ page }, testInfo) => {
    await mockExternalServices(page);

    await page.goto('/signup');

    await expect(
      page.getByRole('heading', { name: /sign up|create.*account|get started/i }),
    ).toBeVisible({ timeout: 10000 });

    // Role selection tabs (Pet Owner / Clinic)
    const ownerTab = page
      .getByRole('tab', { name: /pet owner|owner/i })
      .or(page.getByText(/pet owner/i));
    await expect(ownerTab.first()).toBeVisible();

    await takeScreenshot(page, testInfo, 'signup-form', SUBDIR);
  });

  test('Forgot Password page — email form', async ({ page }, testInfo) => {
    await mockExternalServices(page);

    await page.goto('/forgot-password', { waitUntil: 'domcontentloaded' });

    await expect(
      page.getByRole('heading', { name: /forgot.*password|reset.*password/i }),
    ).toBeVisible({ timeout: 10000 });
    await expect(page.locator('input[type="email"]')).toBeVisible();

    await takeScreenshot(page, testInfo, 'forgot-password', SUBDIR);
  });

  test('Reset Password page — new password form', async ({ page }, testInfo) => {
    await mockExternalServices(page);

    await page.goto('/reset-password');

    // May show error without valid token, but page should render
    const heading = page
      .getByRole('heading', { name: /reset.*password|new.*password/i })
      .or(page.getByText(/reset.*password|new.*password/i));
    await expect(heading.first()).toBeVisible({ timeout: 10000 });

    await takeScreenshot(page, testInfo, 'reset-password', SUBDIR);
  });

  test('MFA Setup page', async ({ page }, testInfo) => {
    await mockExternalServices(page);

    await page.goto('/mfa/setup');

    // May redirect to login if unauthenticated — capture whatever renders
    const mfaHeading = page
      .getByRole('heading', { name: /mfa|multi-factor|two-factor|authenticator/i })
      .or(page.getByRole('heading', { name: /log in/i }));
    await expect(mfaHeading.first()).toBeVisible({ timeout: 10000 });

    await takeScreenshot(page, testInfo, 'mfa-setup', SUBDIR);
  });

  test('MFA Verify page', async ({ page }, testInfo) => {
    await mockExternalServices(page);

    await page.goto('/mfa/verify');

    // May redirect to login if unauthenticated — capture whatever renders
    const heading = page
      .getByRole('heading', { name: /verify|mfa|code|log in/i })
      .or(page.getByText(/verification code|enter.*code/i));
    await expect(heading.first()).toBeVisible({ timeout: 10000 });

    await takeScreenshot(page, testInfo, 'mfa-verify', SUBDIR);
  });
});
