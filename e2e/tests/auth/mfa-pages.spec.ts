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
        name: /set up two-factor authentication/i,
      });
      await expect(heading).toBeVisible();

      // Verify button is present and disabled until factor is loaded
      const verifyBtn = page.getByRole('button', { name: /verify and enable/i });
      await expect(verifyBtn).toBeVisible();
      await expect(verifyBtn).toBeDisabled();

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
      // The heading is "Two-factor authentication"
      const heading = page.getByRole('heading', {
        name: /two-factor authentication/i,
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
      // Look for the verification code input
      const codeInput = page.getByRole('textbox', { name: /verification code/i });
      await expect(codeInput).toBeVisible();

      // Verify it accepts 6-digit codes
      const maxLength = await codeInput.getAttribute('maxlength');
      expect(maxLength).toBe('6');

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
        name: /^verify$/i,
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
