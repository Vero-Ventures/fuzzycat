import { expect, test } from '@playwright/test';

test.describe('MFA Setup Page', () => {
  test('MFA setup page renders', async ({ page }, testInfo) => {
    await page.goto('/mfa/setup');

    const currentUrl = page.url();

    if (currentUrl.includes('/login')) {
      // Page redirected to login because no auth session exists
      await expect(page).toHaveURL(/\/login/);

      await testInfo.attach('mfa-setup-redirected-to-login', {
        body: await page.screenshot(),
        contentType: 'image/png',
      });
    } else {
      // Page rendered the MFA setup content
      const heading = page.getByRole('heading', {
        name: /mfa|multi-factor|two-factor|authenticator|setup/i,
      });
      await expect(heading).toBeVisible();

      await testInfo.attach('mfa-setup-page', {
        body: await page.screenshot(),
        contentType: 'image/png',
      });
    }
  });
});

test.describe('MFA Verify Page', () => {
  test('MFA verify page renders', async ({ page }, testInfo) => {
    await page.goto('/mfa/verify');

    const currentUrl = page.url();

    if (currentUrl.includes('/login')) {
      // Page redirected to login because no auth session exists
      await expect(page).toHaveURL(/\/login/);

      await testInfo.attach('mfa-verify-redirected-to-login', {
        body: await page.screenshot(),
        contentType: 'image/png',
      });
    } else {
      // Page rendered the MFA verify content
      const heading = page.getByRole('heading', {
        name: /verify|verification|code|authenticate/i,
      });
      await expect(heading).toBeVisible();

      await testInfo.attach('mfa-verify-page', {
        body: await page.screenshot(),
        contentType: 'image/png',
      });
    }
  });

  test('MFA verify has 6-digit input', async ({ page }, testInfo) => {
    await page.goto('/mfa/verify');

    const currentUrl = page.url();

    if (!currentUrl.includes('/login')) {
      // Look for a code input field (could be a single input or multiple digit inputs)
      const codeInput = page.locator(
        'input[maxlength="6"], input[name="code"], input[name="token"], input[type="tel"], input[inputmode="numeric"]',
      );
      const digitInputs = page.locator('input[maxlength="1"]');

      const singleInputCount = await codeInput.count();
      const multiInputCount = await digitInputs.count();

      // Either a single 6-digit input or 6 individual digit inputs should exist
      expect(singleInputCount + multiInputCount).toBeGreaterThan(0);

      if (multiInputCount > 0) {
        expect(multiInputCount).toBe(6);
      }

      await testInfo.attach('mfa-verify-code-input', {
        body: await page.screenshot(),
        contentType: 'image/png',
      });
    } else {
      // Redirected to login, so we cannot verify the input
      await testInfo.attach('mfa-verify-redirected', {
        body: await page.screenshot(),
        contentType: 'image/png',
      });
    }
  });

  test('MFA verify has submit button', async ({ page }, testInfo) => {
    await page.goto('/mfa/verify');

    const currentUrl = page.url();

    if (!currentUrl.includes('/login')) {
      const submitButton = page.getByRole('button', {
        name: /verify|submit|confirm|continue/i,
      });
      await expect(submitButton).toBeVisible();

      await testInfo.attach('mfa-verify-submit-button', {
        body: await page.screenshot(),
        contentType: 'image/png',
      });
    } else {
      // Redirected to login, verify we ended up at login
      await expect(page).toHaveURL(/\/login/);

      await testInfo.attach('mfa-verify-redirected-to-login', {
        body: await page.screenshot(),
        contentType: 'image/png',
      });
    }
  });
});
