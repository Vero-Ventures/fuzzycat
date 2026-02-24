import { expect, test } from '@playwright/test';

test.describe('Login Page', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/login');
  });

  test('shows required field validation', async ({ page }, testInfo) => {
    const emailInput = page.getByRole('textbox', { name: /email/i });
    const passwordInput = page.locator('input[type="password"]');

    // Both inputs have required attribute in the DOM
    await expect(emailInput).toHaveAttribute('required', '');
    await expect(passwordInput).toHaveAttribute('required', '');

    await page.getByRole('button', { name: /sign in/i }).click();

    // The form should not navigate away due to HTML validation
    await expect(page).toHaveURL(/\/login/);

    await testInfo.attach('validation-state', {
      body: await page.screenshot(),
      contentType: 'image/png',
    });
  });

  test('shows error for invalid credentials', async ({ page }, testInfo) => {
    await page.getByRole('textbox', { name: /email/i }).fill('invalid@example.com');
    await page.locator('input[type="password"]').fill('wrongpassword123');
    await page.getByRole('button', { name: /sign in/i }).click();

    // Wait for the error message to appear after form submission.
    // Supabase may return different error messages depending on configuration;
    // the form catch block returns "Something went wrong" when the call throws.
    const errorMessage = page.getByRole('alert');
    await expect(errorMessage).toBeVisible({ timeout: 10000 });

    await testInfo.attach('invalid-credentials-error', {
      body: await page.screenshot(),
      contentType: 'image/png',
    });
  });
});
