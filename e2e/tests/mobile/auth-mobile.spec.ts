import { expect, test } from '@playwright/test';

test.describe('Auth Pages — Mobile', () => {
  test('login form fully functional on mobile', async ({ page }, testInfo) => {
    await page.goto('/login');

    // All form elements visible
    const emailInput = page.locator('input[type="email"]');
    const passwordInput = page.locator('input[type="password"]');
    const submitBtn = page.getByRole('button', { name: /sign in|log in|submit/i });

    await expect(emailInput).toBeVisible();
    await expect(passwordInput).toBeVisible();
    await expect(submitBtn).toBeVisible();

    // Fill form on mobile
    await emailInput.fill('test@example.com');
    await passwordInput.fill('TestPassword123!');

    // Links visible
    const signupLink = page.getByRole('link', { name: /sign up|create.*account/i });
    await expect(signupLink).toBeVisible();

    const forgotLink = page.getByRole('link', { name: /forgot.*password/i });
    await expect(forgotLink).toBeVisible();

    // No horizontal overflow
    const hasOverflow = await page.evaluate(() => {
      return document.documentElement.scrollWidth > document.documentElement.clientWidth;
    });
    expect(hasOverflow).toBe(false);

    await testInfo.attach('mobile-login-filled', {
      body: await page.screenshot({ fullPage: true }),
      contentType: 'image/png',
    });
  });

  test('login validation on mobile', async ({ page }) => {
    await page.goto('/login');

    const emailInput = page.locator('input[type="email"]');
    const submitBtn = page.getByRole('button', { name: /sign in|log in|submit/i });

    await emailInput.fill('not-an-email');
    await submitBtn.click();

    const isInvalid = await emailInput.evaluate((el) => !(el as HTMLInputElement).validity.valid);
    expect(isInvalid).toBe(true);
  });

  test('signup form with tabs on mobile', async ({ page }, testInfo) => {
    await page.route('**/challenges.cloudflare.com/**', (route) =>
      route.fulfill({
        status: 200,
        contentType: 'application/javascript',
        body: 'window.turnstile = { render: function(el, opts) { if (opts && opts.callback) opts.callback("mock-token"); return "mock-id"; }, reset: function() {}, remove: function() {} };',
      }),
    );
    await page.goto('/signup');

    // Tab switching works on mobile
    const clinicTab = page
      .getByRole('tab', { name: /veterinary clinic|clinic/i })
      .or(page.getByText(/veterinary clinic/i));

    if (
      await clinicTab
        .first()
        .isVisible({ timeout: 3000 })
        .catch(() => false)
    ) {
      await clinicTab.first().click();

      // Clinic fields visible
      const clinicNameInput = page.locator('#clinicName');
      await expect(clinicNameInput).toBeVisible({ timeout: 3000 });
    }

    // Switch back to owner tab
    const ownerTab = page
      .getByRole('tab', { name: /pet owner|owner/i })
      .or(page.getByText(/pet owner/i));

    if (
      await ownerTab
        .first()
        .isVisible({ timeout: 3000 })
        .catch(() => false)
    ) {
      await ownerTab.first().click();
    }

    // Fill form on mobile
    const emailInput = page.locator('#email');
    await emailInput.fill('mobile@example.com');
    await page.locator('#password').fill('MobilePass123!');

    const nameInput = page.locator('#name');
    if (await nameInput.isVisible({ timeout: 2000 }).catch(() => false)) {
      await nameInput.fill('Mobile User');
    }

    await testInfo.attach('mobile-signup', {
      body: await page.screenshot({ fullPage: true }),
      contentType: 'image/png',
    });
  });

  test('forgot password flow on mobile', async ({ page }, testInfo) => {
    await page.goto('/forgot-password');

    const emailInput = page.locator('#email');
    await expect(emailInput).toBeVisible();
    await emailInput.fill('test@example.com');

    const submitBtn = page.getByRole('button', { name: /send.*reset|reset/i });
    await expect(submitBtn).toBeVisible();
    await submitBtn.click();

    // Should show confirmation
    await expect(page.getByText(/check your email|sent.*link/i).first()).toBeVisible({
      timeout: 10000,
    });

    await testInfo.attach('mobile-forgot-password-confirmation', {
      body: await page.screenshot({ fullPage: true }),
      contentType: 'image/png',
    });
  });

  test('reset password form on mobile', async ({ page }, testInfo) => {
    await page.goto('/reset-password');

    const passwordInput = page.locator('#password');
    const confirmInput = page.locator('#confirm-password');

    await expect(passwordInput).toBeVisible();
    await expect(confirmInput).toBeVisible();

    await passwordInput.fill('NewPassword123!');
    await confirmInput.fill('NewPassword123!');

    const submitBtn = page.getByRole('button', {
      name: /update.*password|reset.*password|submit/i,
    });
    await expect(submitBtn).toBeVisible();

    await testInfo.attach('mobile-reset-password', {
      body: await page.screenshot({ fullPage: true }),
      contentType: 'image/png',
    });
  });
});
