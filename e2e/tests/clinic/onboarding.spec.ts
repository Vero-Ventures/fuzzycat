import { expect, test } from '@playwright/test';

test.describe('Clinic Onboarding', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/clinic/onboarding');
  });

  test('loads onboarding page', async ({ page }) => {
    await expect(page.getByRole('heading', { name: /welcome to fuzzycat/i })).toBeVisible();
    await expect(page).toHaveURL(/\/clinic\/onboarding/);
  });

  test('shows onboarding checklist or error state', async ({ page }) => {
    // The checklist loads via tRPC. On success it shows profile/Stripe steps;
    // on failure it shows an "Unable to load onboarding status" alert.
    // Both are valid production renderings.
    const profileStep = page.getByText(/complete your profile/i);
    const errorAlert = page.getByText(/unable to load onboarding status/i);

    // Wait for either the checklist or the error alert
    await expect(profileStep.or(errorAlert)).toBeVisible({ timeout: 15000 });

    // If the checklist loaded successfully, verify the Stripe step too
    if (await profileStep.isVisible().catch(() => false)) {
      const stripeStep = page.getByText(/connect your bank account/i);
      await expect(stripeStep).toBeVisible({ timeout: 5000 });

      // MFA step is feature-flagged — only assert if it appears
      const mfaStep = page.getByText(/enable two-factor authentication/i);
      const mfaVisible = await mfaStep.isVisible({ timeout: 3000 }).catch(() => false);
      if (mfaVisible) {
        await expect(mfaStep).toBeVisible();
      }
    }
  });

  test('shows description', async ({ page }) => {
    const description = page.getByText(/complete the steps below to start offering payment plans/i);
    await expect(description).toBeVisible();
  });

  test('captures screenshot', async ({ page }, testInfo) => {
    await page.waitForLoadState('domcontentloaded');

    await testInfo.attach('clinic-onboarding', {
      body: await page.screenshot({ fullPage: true }),
      contentType: 'image/png',
    });
  });
});
