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
    // The ClinicProfileForm renders a card with "Clinic Information" title
    const clinicInfo = page.getByText(/clinic information/i);
    await expect(clinicInfo).toBeVisible({ timeout: 10000 });
  });

  test('shows Stripe Connect section', async ({ page }) => {
    // The StripeConnectSection renders a card with "Stripe Connect" title
    const stripeConnect = page.getByText(/stripe connect/i);
    await expect(stripeConnect).toBeVisible({ timeout: 10000 });
  });

  test('shows MFA settings section', async ({ page }) => {
    // The MfaSettingsSection renders a card with "Multi-Factor Authentication" title
    const mfaSection = page.getByText(/multi-factor authentication/i);
    await expect(mfaSection).toBeVisible({ timeout: 10000 });
  });

  test('shows page description', async ({ page }) => {
    const description = page.getByText(
      /manage your clinic information, payment account, and security/i,
    );
    await expect(description).toBeVisible();
  });

  test('captures screenshot', async ({ page }, testInfo) => {
    await page.waitForLoadState('networkidle');

    await testInfo.attach('clinic-settings', {
      body: await page.screenshot({ fullPage: true }),
      contentType: 'image/png',
    });
  });
});
