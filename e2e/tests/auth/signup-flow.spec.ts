import { expect, test } from '@playwright/test';

test.describe('Signup Page', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/signup');
  });

  test('renders signup form', async ({ page }, testInfo) => {
    await expect(page.getByRole('heading', { name: /create an account/i })).toBeVisible();

    await testInfo.attach('signup-form', {
      body: await page.screenshot(),
      contentType: 'image/png',
    });
  });

  test('shows pet owner tab by default', async ({ page }, testInfo) => {
    const ownerTab = page.getByRole('tab', { name: /pet owner/i });
    await expect(ownerTab).toBeVisible();
    // Active tab has aria-selected="true"
    await expect(ownerTab).toHaveAttribute('aria-selected', 'true');

    // Owner-specific fields should be visible
    await expect(page.getByRole('textbox', { name: /email/i })).toBeVisible();
    await expect(page.locator('input[type="password"]')).toBeVisible();

    await testInfo.attach('owner-tab-default', {
      body: await page.screenshot(),
      contentType: 'image/png',
    });
  });

  test('can switch to clinic tab', async ({ page }, testInfo) => {
    const clinicTab = page.getByRole('tab', {
      name: /veterinary clinic/i,
    });
    await clinicTab.click();

    // Active tab has aria-selected="true"
    await expect(clinicTab).toHaveAttribute('aria-selected', 'true');

    // Clinic-specific fields should now be visible
    await expect(page.getByRole('textbox', { name: /email/i })).toBeVisible();
    await expect(page.locator('input[type="password"]')).toBeVisible();

    await testInfo.attach('clinic-tab-selected', {
      body: await page.screenshot(),
      contentType: 'image/png',
    });
  });

  test('owner form has required fields', async ({ page }) => {
    const emailInput = page.getByRole('textbox', { name: /email/i });
    const passwordInput = page.locator('input[type="password"]');

    await expect(emailInput).toBeVisible();
    await expect(emailInput).toHaveAttribute('type', 'email');

    await expect(passwordInput).toBeVisible();
    await expect(passwordInput).toHaveAttribute('type', 'password');
  });

  test('clinic form has required fields', async ({ page }) => {
    const clinicTab = page.getByRole('tab', {
      name: /veterinary clinic/i,
    });
    await clinicTab.click();

    const emailInput = page.getByRole('textbox', { name: /email/i });
    const passwordInput = page.locator('input[type="password"]');

    await expect(emailInput).toBeVisible();
    await expect(emailInput).toHaveAttribute('type', 'email');

    await expect(passwordInput).toBeVisible();
    await expect(passwordInput).toHaveAttribute('type', 'password');
  });

  test('shows validation for empty submission', async ({ page }, testInfo) => {
    const emailInput = page.getByRole('textbox', { name: /email/i });
    const passwordInput = page.locator('input[type="password"]');

    await expect(emailInput).toHaveAttribute('required', '');
    await expect(passwordInput).toHaveAttribute('required', '');

    await page.getByRole('button', { name: /create account/i }).click();

    // The form should not navigate away due to HTML validation
    await expect(page).toHaveURL(/\/signup/);

    await testInfo.attach('empty-submission-validation', {
      body: await page.screenshot(),
      contentType: 'image/png',
    });
  });

  test('has link to login page', async ({ page }) => {
    const loginLink = page.getByRole('link', {
      name: /log in/i,
    });
    await expect(loginLink).toBeVisible();
    await expect(loginLink).toHaveAttribute('href', /\/login/);
  });

  test('password has minimum length requirement', async ({ page }, testInfo) => {
    const passwordInput = page.locator('input[type="password"]');

    // Check for minlength attribute
    const minlength = await passwordInput.getAttribute('minlength');

    if (minlength) {
      expect(Number(minlength)).toBeGreaterThanOrEqual(8);
    } else {
      // If no minlength attribute, try submitting a short password
      await page.getByRole('textbox', { name: /email/i }).fill('test@example.com');
      await passwordInput.fill('short');
      await page.getByRole('button', { name: /create account/i }).click();

      // Expect an error about password length
      const errorMessage = page.getByText(
        /password.*short|password.*minimum|password.*least|password.*characters/i,
      );
      await expect(errorMessage).toBeVisible({ timeout: 10000 });
    }

    await testInfo.attach('password-min-length', {
      body: await page.screenshot(),
      contentType: 'image/png',
    });
  });
});
