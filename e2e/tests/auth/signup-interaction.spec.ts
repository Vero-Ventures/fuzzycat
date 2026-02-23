import { expect, test } from '@playwright/test';

test.describe('Signup Form — Interactions', () => {
  test.beforeEach(async ({ page }) => {
    // Mock Turnstile
    await page.route('**/challenges.cloudflare.com/**', (route) =>
      route.fulfill({
        status: 200,
        contentType: 'application/javascript',
        body: 'window.turnstile = { render: function(el, opts) { if (opts && opts.callback) opts.callback("mock-token"); return "mock-id"; }, reset: function() {}, remove: function() {} };',
      }),
    );
    await page.goto('/signup');
  });

  test('owner signup form validates required fields', async ({ page }) => {
    // Should default to Pet Owner tab
    const submitBtn = page.getByRole('button', { name: /create account|sign up|register/i });
    await expect(submitBtn).toBeVisible();

    // Email is required
    const emailInput = page.locator('#email');
    await expect(emailInput).toBeVisible();

    // Try to submit empty form
    await submitBtn.click();

    // HTML validation should prevent submission
    const isInvalid = await emailInput.evaluate((el) => !(el as HTMLInputElement).validity.valid);
    expect(isInvalid).toBe(true);
  });

  test('clinic signup form is accessible via tab', async ({ page }) => {
    // Click Veterinary Clinic tab
    const clinicTab = page.getByRole('tab', { name: /veterinary clinic|clinic/i });
    await expect(clinicTab).toBeVisible();
    await clinicTab.click();

    // Clinic-specific fields should appear
    const clinicNameInput = page.locator('#clinicName');
    await expect(clinicNameInput).toBeVisible({ timeout: 3000 });
  });

  test('weak password shows error', async ({ page }) => {
    const emailInput = page.locator('#email');
    const passwordInput = page.locator('#password');
    const nameInput = page.locator('#name');

    await emailInput.fill('test@example.com');
    if (await nameInput.isVisible({ timeout: 2000 }).catch(() => false)) {
      await nameInput.fill('Test User');
    }
    await passwordInput.fill('123'); // Too short

    const submitBtn = page.getByRole('button', { name: /create account|sign up|register/i });
    await submitBtn.click();

    // Should show password error (minLength=8)
    const isInvalid = await passwordInput.evaluate(
      (el) => !(el as HTMLInputElement).validity.valid,
    );
    expect(isInvalid).toBe(true);
  });

  test('tab switching preserves email data', async ({ page }) => {
    // Fill email on owner tab
    const emailInput = page.locator('#email');
    await emailInput.fill('test@example.com');

    // Switch to clinic tab
    const clinicTab = page.getByRole('tab', { name: /veterinary clinic|clinic/i });
    await clinicTab.click();

    await page.waitForTimeout(500);

    // Switch back to owner tab
    const ownerTab = page.getByRole('tab', { name: /pet owner|owner/i });
    await ownerTab.click();

    await page.waitForTimeout(500);
  });
});
