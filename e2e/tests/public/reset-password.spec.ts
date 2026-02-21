import { expect, test } from '@playwright/test';

test.describe('Reset Password page', () => {
  test('renders reset password form', async ({ page }, testInfo) => {
    await page.goto('/reset-password');

    await expect(page.locator('h1')).toContainText('Set a new password');
    await expect(page.locator('input#password')).toBeVisible();
    await expect(page.locator('input#confirm-password')).toBeVisible();
    await expect(page.getByRole('button', { name: /update password/i })).toBeVisible();

    const screenshot = await page.screenshot({ fullPage: true });
    await testInfo.attach('reset-password-form', {
      body: screenshot,
      contentType: 'image/png',
    });
  });

  test('shows validation for mismatched passwords', async ({ page }, testInfo) => {
    await page.goto('/reset-password');

    await page.locator('input#password').fill('SecurePass123');
    await page.locator('input#confirm-password').fill('DifferentPass456');
    await page.getByRole('button', { name: /update password/i }).click();

    await expect(page.getByText('Passwords do not match')).toBeVisible();

    const screenshot = await page.screenshot({ fullPage: true });
    await testInfo.attach('mismatched-passwords-error', {
      body: screenshot,
      contentType: 'image/png',
    });
  });

  test('shows validation for short password', async ({ page }, testInfo) => {
    await page.goto('/reset-password');

    // The inputs have minLength=8, so HTML5 validation prevents submission.
    // Verify the minlength attribute exists as the first line of defense.
    const passwordInput = page.locator('input#password');
    const confirmInput = page.locator('input#confirm-password');
    await expect(passwordInput).toHaveAttribute('minlength', '8');
    await expect(confirmInput).toHaveAttribute('minlength', '8');

    // Remove minlength via JS to test the client-side validation fallback
    await passwordInput.evaluate((el) => el.removeAttribute('minlength'));
    await confirmInput.evaluate((el) => el.removeAttribute('minlength'));

    await passwordInput.fill('short');
    await confirmInput.fill('short');
    await page.getByRole('button', { name: /update password/i }).click();

    await expect(page.getByText('Password must be at least 8 characters')).toBeVisible();

    const screenshot = await page.screenshot({ fullPage: true });
    await testInfo.attach('short-password-error', {
      body: screenshot,
      contentType: 'image/png',
    });
  });

  test('has password fields with correct attributes', async ({ page }, testInfo) => {
    await page.goto('/reset-password');

    const passwordInput = page.locator('input#password');
    const confirmInput = page.locator('input#confirm-password');

    await expect(passwordInput).toHaveAttribute('type', 'password');
    await expect(passwordInput).toHaveAttribute('required', '');
    await expect(confirmInput).toHaveAttribute('type', 'password');
    await expect(confirmInput).toHaveAttribute('required', '');

    const screenshot = await page.screenshot({ fullPage: true });
    await testInfo.attach('password-field-attributes', {
      body: screenshot,
      contentType: 'image/png',
    });
  });
});
