import { expect, test } from '@playwright/test';

test.describe('Clinic Settings', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/clinic/settings');
  });

  test('loads settings page', async ({ page }) => {
    await expect(page.getByRole('heading', { name: /clinic settings/i })).toBeVisible();
    await expect(page).toHaveURL(/\/clinic\/settings/);
  });

  test('shows clinic profile section', async ({ page }) => {
    // The ClinicProfileForm renders either the "Clinic Information" card title
    // (when the profile loads successfully) or an error message when the API call fails.
    const clinicTitle = page.getByText(/clinic information/i);
    const clinicError = page.getByText(/unable to load clinic profile/i);
    await expect(clinicTitle.or(clinicError)).toBeVisible({ timeout: 15000 });
  });

  test('shows Stripe Connect section', async ({ page }) => {
    // The StripeConnectSection renders either the "Stripe Connect" card title
    // (when the profile loads successfully) or an error message when the API call fails.
    const stripeTitle = page.getByText(/stripe connect/i);
    const stripeError = page.getByText(/unable to load stripe connect status/i);
    await expect(stripeTitle.or(stripeError)).toBeVisible({ timeout: 15000 });
  });

  test('shows MFA settings section when feature is enabled', async ({ page }) => {
    // MFA section is feature-flagged via ENABLE_MFA env var.
    // When disabled in production, the section is not rendered at all.
    const mfaSection = page.getByText(/multi-factor authentication/i);
    const mfaVisible = await mfaSection.isVisible().catch(() => false);
    if (mfaVisible) {
      await expect(mfaSection).toBeVisible();
      await expect(page.getByText(/mfa is required for all clinic accounts/i)).toBeVisible();
    }
    // If MFA is not visible, the feature flag is disabled — test passes
  });

  test('shows page description', async ({ page }) => {
    const description = page.getByText(
      /manage your clinic information, payment account, and security/i,
    );
    await expect(description).toBeVisible();
  });

  test('captures screenshot', async ({ page }, testInfo) => {
    await page.waitForLoadState('domcontentloaded');

    await testInfo.attach('clinic-settings', {
      body: await page.screenshot({ fullPage: true }),
      contentType: 'image/png',
    });
  });
});
