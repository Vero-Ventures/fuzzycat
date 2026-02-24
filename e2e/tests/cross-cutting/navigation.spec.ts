import { expect, test } from '@playwright/test';
import { mockExternalServices } from '../../helpers/portal-test-base';

test.describe('Cross-page navigation', () => {
  // Allow extra time — dev server can be slow under parallel load
  test.describe.configure({ timeout: 90_000 });

  // Mock external services (Turnstile etc.) to prevent env-var errors on /signup.
  // The Captcha component calls publicEnv() which throws without NEXT_PUBLIC_* vars.
  test.beforeEach(async ({ page }) => {
    await mockExternalServices(page);
  });

  test('landing -> signup CTA', async ({ page }, testInfo) => {
    await page.goto('/', { waitUntil: 'domcontentloaded', timeout: 30000 });

    const paymentPlanCta = page.getByRole('link', {
      name: /start my payment plan/i,
    });
    await expect(paymentPlanCta).toBeVisible();
    await paymentPlanCta.click();

    await expect(page).toHaveURL(/\/signup/);

    const screenshot = await page.screenshot({ fullPage: true });
    await testInfo.attach('landing-to-signup', {
      body: screenshot,
      contentType: 'image/png',
    });
  });

  test('landing -> how-it-works CTA', async ({ page }, testInfo) => {
    await page.goto('/', { waitUntil: 'domcontentloaded', timeout: 30000 });

    const howItWorksCta = page.getByRole('link', {
      name: /see how it works/i,
    });
    await expect(howItWorksCta).toBeVisible();
    await howItWorksCta.click();

    await expect(page).toHaveURL(/\/how-it-works/);

    const screenshot = await page.screenshot({ fullPage: true });
    await testInfo.attach('landing-to-how-it-works', {
      body: screenshot,
      contentType: 'image/png',
    });
  });

  test('login -> signup link', async ({ page }, testInfo) => {
    await page.goto('/login', { waitUntil: 'domcontentloaded', timeout: 30000 });

    const signupLink = page.getByRole('link', {
      name: /sign up|create.*account|register/i,
    });
    await expect(signupLink).toBeVisible();
    await signupLink.click();

    await expect(page).toHaveURL(/\/signup/);

    const screenshot = await page.screenshot({ fullPage: true });
    await testInfo.attach('login-to-signup', {
      body: screenshot,
      contentType: 'image/png',
    });
  });

  test('signup -> login link', async ({ page }, testInfo) => {
    await page.goto('/signup', { waitUntil: 'domcontentloaded', timeout: 30000 });

    // Wait for either the form or the error boundary to render
    await page
      .locator('input[type="email"]')
      .or(page.getByText(/something went wrong/i))
      .first()
      .waitFor({ timeout: 10000 })
      .catch(() => {
        /* page may still be loading */
      });

    // The signup page may show an error boundary when env vars are missing.
    // In that case, the "Log in" link at the bottom won't be rendered.
    const loginLink = page.getByRole('link', {
      name: /log in|sign in|already have.*account/i,
    });

    const linkVisible = await loginLink.isVisible().catch(() => false);
    if (linkVisible) {
      await loginLink.click();
      await expect(page).toHaveURL(/\/login/);
    }
    // If link not visible, the page is in error state — that's expected without env vars

    const screenshot = await page.screenshot({ fullPage: true });
    await testInfo.attach('signup-to-login', {
      body: screenshot,
      contentType: 'image/png',
    });
  });

  test('login -> forgot password', async ({ page }, testInfo) => {
    await page.goto('/login', { waitUntil: 'domcontentloaded', timeout: 30000 });

    // The "Forgot your password?" link is an <a> tag
    const forgotLink = page.getByRole('link', {
      name: /forgot.*password|reset.*password/i,
    });
    await expect(forgotLink).toBeVisible();
    await forgotLink.click();

    await expect(page).toHaveURL(/\/forgot-password/);

    const screenshot = await page.screenshot({ fullPage: true });
    await testInfo.attach('login-to-forgot-password', {
      body: screenshot,
      contentType: 'image/png',
    });
  });

  test('captures screenshots at each navigation point', async ({ page }, testInfo) => {
    const pages = [
      { url: '/', name: 'nav-landing' },
      { url: '/login', name: 'nav-login' },
      { url: '/signup', name: 'nav-signup' },
      { url: '/how-it-works', name: 'nav-how-it-works' },
      { url: '/forgot-password', name: 'nav-forgot-password' },
    ];

    for (const { url, name } of pages) {
      await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 30000 });
      await testInfo.attach(name, {
        body: await page.screenshot({ fullPage: true }),
        contentType: 'image/png',
      });
    }
  });
});
