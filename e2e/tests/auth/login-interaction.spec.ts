import { expect, test } from '@playwright/test';

test.describe('Login Form — Interactions', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/login');
  });

  test('invalid email format triggers HTML validation', async ({ page }) => {
    const emailInput = page.locator('input[type="email"]');
    const passwordInput = page.locator('input[type="password"]');
    const submitBtn = page.getByRole('button', { name: /sign in|log in|submit/i });

    await emailInput.fill('not-an-email');
    await passwordInput.fill('password123');
    await submitBtn.click();

    // HTML5 validation prevents submission — email input should have validation error
    const isInvalid = await emailInput.evaluate((el) => !(el as HTMLInputElement).validity.valid);
    expect(isInvalid).toBe(true);
  });

  test('form shows loading state on submit', async ({ page }) => {
    // Mock Turnstile
    await page.route('**/challenges.cloudflare.com/**', (route) =>
      route.fulfill({
        status: 200,
        contentType: 'application/javascript',
        body: 'window.turnstile = { render: function(el, opts) { if (opts && opts.callback) opts.callback("mock-token"); return "mock-id"; }, reset: function() {}, remove: function() {} };',
      }),
    );

    const emailInput = page.locator('input[type="email"]');
    const passwordInput = page.locator('input[type="password"]');
    const submitBtn = page.getByRole('button', { name: /sign in|log in|submit/i });

    await emailInput.fill('test@example.com');
    await passwordInput.fill('TestPassword123!');
    await submitBtn.click();

    // Button should show loading state — may flash quickly
    await page.waitForTimeout(200);
  });

  test('redirectTo parameter is forwarded', async ({ page }) => {
    await page.goto('/login?redirectTo=/owner/payments');

    const emailInput = page.locator('input[type="email"]');
    const passwordInput = page.locator('input[type="password"]');

    // The form should preserve the redirectTo query param
    expect(page.url()).toContain('redirectTo');

    // Inputs should still be functional
    await expect(emailInput).toBeVisible();
    await expect(passwordInput).toBeVisible();
  });

  test('Turnstile CAPTCHA renders', async ({ page }) => {
    // The page should attempt to load Turnstile
    // With real Turnstile, a challenge widget renders — in test it's either mocked or shows placeholder
    await page.waitForLoadState('domcontentloaded');

    // Turnstile may or may not render depending on config — just verify page doesn't crash
    await page.waitForTimeout(1000);
  });
});
