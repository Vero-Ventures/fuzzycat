import { expect, test } from '@playwright/test';

test.describe('Login Page', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/login');
  });

  test('renders login form', async ({ page }, testInfo) => {
    await expect(page.getByRole('heading', { name: /log in to fuzzycat/i })).toBeVisible();
    await expect(page.getByRole('textbox', { name: /email/i })).toBeVisible();
    await expect(page.locator('input[type="password"]')).toBeVisible();
    await expect(page.getByRole('button', { name: /sign in/i })).toBeVisible();

    await testInfo.attach('login-form', {
      body: await page.screenshot(),
      contentType: 'image/png',
    });
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

  test('email field has correct attributes', async ({ page }) => {
    const emailInput = page.getByRole('textbox', { name: /email/i });
    await expect(emailInput).toHaveAttribute('type', 'email');
    await expect(emailInput).toHaveAttribute('autocomplete', /.*/);
  });

  test('password field has correct attributes', async ({ page }) => {
    const passwordInput = page.locator('input[type="password"]');
    await expect(passwordInput).toHaveAttribute('type', 'password');
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

  test('has link to signup page', async ({ page }) => {
    const signupLink = page.getByRole('link', { name: /sign up/i });
    await expect(signupLink).toBeVisible();
    await expect(signupLink).toHaveAttribute('href', /\/signup/);
  });

  test('has link to forgot password', async ({ page }) => {
    const forgotLink = page.getByRole('link', {
      name: /forgot.*password/i,
    });
    await expect(forgotLink).toBeVisible();
    await expect(forgotLink).toHaveAttribute('href', /\/forgot-password/);
  });

  test('preserves redirectTo parameter', async ({ page }, testInfo) => {
    await page.goto('/login?redirectTo=/owner/payments');
    await expect(page).toHaveURL(/redirectTo=%2Fowner%2Fpayments|redirectTo=\/owner\/payments/);

    await testInfo.attach('redirect-param-preserved', {
      body: await page.screenshot(),
      contentType: 'image/png',
    });
  });
});
