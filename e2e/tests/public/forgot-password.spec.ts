import { expect, test } from '@playwright/test';

test.describe('Forgot Password page', () => {
  test('renders forgot password form', async ({ page }, testInfo) => {
    await page.goto('/forgot-password');

    await expect(page.locator('h1')).toContainText('Reset your password');
    await expect(page.locator('input[type="email"]')).toBeVisible();
    await expect(page.getByRole('button', { name: /send reset link/i })).toBeVisible();

    const screenshot = await page.screenshot({ fullPage: true });
    await testInfo.attach('forgot-password-form', {
      body: screenshot,
      contentType: 'image/png',
    });
  });

  test('shows validation for empty email', async ({ page }, testInfo) => {
    await page.goto('/forgot-password');

    // The email input has the required attribute — HTML5 validation prevents submission
    const emailInput = page.locator('input[type="email"]');
    await expect(emailInput).toHaveAttribute('required', '');

    // Attempt to submit with empty email
    await page.getByRole('button', { name: /send reset link/i }).click();

    // Should remain on the same page (form was not submitted)
    await expect(page.getByText('Check your email')).not.toBeVisible();
    await expect(page).toHaveURL(/\/forgot-password/);

    const screenshot = await page.screenshot({ fullPage: true });
    await testInfo.attach('empty-email-validation', {
      body: screenshot,
      contentType: 'image/png',
    });
  });

  test('shows confirmation after submission', async ({ page }, testInfo) => {
    await page.goto('/forgot-password');

    await page.locator('input[type="email"]').fill('test@example.com');
    await page.getByRole('button', { name: /send reset link/i }).click();

    await expect(page.getByText('Check your email')).toBeVisible();

    const screenshot = await page.screenshot({ fullPage: true });
    await testInfo.attach('confirmation-after-submission', {
      body: screenshot,
      contentType: 'image/png',
    });
  });

  test('confirmation shows entered email', async ({ page }, testInfo) => {
    await page.goto('/forgot-password');

    const testEmail = 'petowner@example.com';
    await page.locator('input[type="email"]').fill(testEmail);
    await page.getByRole('button', { name: /send reset link/i }).click();

    await expect(page.getByText('Check your email')).toBeVisible();
    await expect(page.getByText(testEmail)).toBeVisible();

    const screenshot = await page.screenshot({ fullPage: true });
    await testInfo.attach('confirmation-shows-email', {
      body: screenshot,
      contentType: 'image/png',
    });
  });

  test('has back to login link', async ({ page }, testInfo) => {
    await page.goto('/forgot-password');

    const loginLink = page.getByRole('link', {
      name: /back to login/i,
    });
    await expect(loginLink).toBeVisible();
    await expect(loginLink).toHaveAttribute('href', '/login');

    const screenshot = await page.screenshot({ fullPage: true });
    await testInfo.attach('back-to-login-link', {
      body: screenshot,
      contentType: 'image/png',
    });
  });
});
