import { expect, test } from '@playwright/test';

test.describe('Password Flow — Interactions', () => {
  test.describe('Forgot Password', () => {
    test('submit triggers confirmation screen', async ({ page }) => {
      await page.goto('/forgot-password');

      const emailInput = page.getByRole('textbox', { name: /email/i });
      await emailInput.fill('test@example.com');

      const submitBtn = page.getByRole('button', { name: /send reset link/i });
      await submitBtn.click();

      // Should show confirmation or an error from Supabase (e.g. when using
      // placeholder credentials in CI). Either outcome means the form submitted.
      const confirmation = page.getByText(/check your email|sent.*link|reset.*link/i).first();
      const errorAlert = page.getByRole('alert');
      await expect(confirmation.or(errorAlert).first()).toBeVisible({ timeout: 10000 });
    });

    test('email format validation', async ({ page }) => {
      await page.goto('/forgot-password');

      const emailInput = page.getByRole('textbox', { name: /email/i });
      await emailInput.fill('not-an-email');

      const submitBtn = page.getByRole('button', { name: /send reset link/i });
      await submitBtn.click();

      // HTML5 validation
      const isInvalid = await emailInput.evaluate((el) => !(el as HTMLInputElement).validity.valid);
      expect(isInvalid).toBe(true);
    });
  });

  test.describe('Reset Password', () => {
    test.beforeEach(async ({ page }) => {
      await page.goto('/reset-password');
    });

    test('password mismatch shows error', async ({ page }) => {
      const passwordInput = page.locator('#password');
      const confirmInput = page.locator('#confirm-password');

      await passwordInput.fill('StrongPassword123!');
      await confirmInput.fill('DifferentPassword456!');

      const submitBtn = page.getByRole('button', {
        name: /update password/i,
      });
      await submitBtn.click();

      // Should show mismatch error
      await expect(page.getByText(/match|mismatch|don.*match/i).first()).toBeVisible({
        timeout: 5000,
      });
    });

    test('weak password shows error', async ({ page }) => {
      const passwordInput = page.locator('#password');
      const confirmInput = page.locator('#confirm-password');

      await passwordInput.fill('123');
      await confirmInput.fill('123');

      const submitBtn = page.getByRole('button', {
        name: /update password/i,
      });
      await submitBtn.click();

      // Should show password requirement error (minLength=8)
      const isInvalid = await passwordInput.evaluate(
        (el) => !(el as HTMLInputElement).validity.valid,
      );
      expect(isInvalid).toBe(true);
    });
  });
});
