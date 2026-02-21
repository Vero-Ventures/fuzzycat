import { expect, test } from '@playwright/test';

// baseURL is https://fuzzycatapp.com (configured in playwright.config.ts for production-auth project)

test.describe('Production login flow', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/login');
  });

  test('login page renders correctly', async ({ page }, testInfo) => {
    // Heading
    await expect(page.getByRole('heading', { name: /log in to fuzzycat/i })).toBeVisible();

    // Form fields
    await expect(page.locator('input[type="email"]')).toBeVisible();
    await expect(page.locator('input[type="password"]')).toBeVisible();

    // Submit button
    await expect(page.getByRole('button', { name: /log in|sign in|submit/i })).toBeVisible();

    // Navigation links
    await expect(
      page.getByRole('link', { name: /sign up|create.*account|register/i }),
    ).toBeVisible();
    await expect(
      page.getByRole('link', { name: /forgot.*password|reset.*password/i }),
    ).toBeVisible();

    await testInfo.attach('prod-login-form', {
      body: await page.screenshot({ fullPage: true }),
      contentType: 'image/png',
    });
  });

  test('shows error for invalid credentials', async ({ page }, testInfo) => {
    await page.locator('input[type="email"]').fill('invalid@example.com');
    await page.locator('input[type="password"]').fill('wrongpassword123');
    await page.getByRole('button', { name: /log in|sign in|submit/i }).click();

    // Wait for the error message to appear after form submission
    const errorMessage = page.getByText(/invalid|incorrect|wrong|error|failed|not found/i);
    await expect(errorMessage).toBeVisible({ timeout: 10000 });

    await testInfo.attach('prod-invalid-credentials-error', {
      body: await page.screenshot({ fullPage: true }),
      contentType: 'image/png',
    });
  });

  test('captures screenshots', async ({ page }, testInfo) => {
    await page.waitForLoadState('networkidle');

    await testInfo.attach('prod-login-page', {
      body: await page.screenshot({ fullPage: true }),
      contentType: 'image/png',
    });
  });
});
