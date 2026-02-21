import { expect, test } from '@playwright/test';

test.describe('Owner Settings Page', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/owner/settings');
  });

  test('loads settings page with heading', async ({ page }, testInfo) => {
    await expect(page.getByRole('heading', { name: /account settings/i })).toBeVisible();

    await testInfo.attach('settings-heading', {
      body: await page.screenshot(),
      contentType: 'image/png',
    });
  });

  test('shows page description about managing profile and plans', async ({ page }) => {
    await expect(
      page.getByText(/manage your profile, payment method, and plan agreements/i),
    ).toBeVisible();
  });

  test('has profile section', async ({ page }) => {
    // The ProfileForm card has heading "Profile Information"
    const profileHeading = page.getByRole('heading', {
      name: /profile information/i,
    });
    const profileFallback = page.getByText(/unable to load profile information/i);

    // Either the profile form or an error fallback should be visible
    await expect(profileHeading.or(profileFallback)).toBeVisible({
      timeout: 10000,
    });
  });

  test('has payment method section', async ({ page }) => {
    // The PaymentMethodSection card has heading "Payment Method"
    const paymentHeading = page.getByRole('heading', {
      name: /payment method/i,
    });

    await expect(paymentHeading).toBeVisible({ timeout: 10000 });

    // Description text about current payment method
    await expect(
      page.getByText(/your current payment method for installment payments/i),
    ).toBeVisible();
  });

  test('has active plans section', async ({ page }) => {
    // The ActivePlansSection card has heading "Payment Plans"
    const plansHeading = page.getByRole('heading', {
      name: /payment plans/i,
    });

    await expect(plansHeading).toBeVisible({ timeout: 10000 });

    // Description text about plan agreements
    await expect(page.getByText(/your payment plan agreements/i)).toBeVisible();
  });

  test('has navigation back to payments in header', async ({ page }) => {
    // The owner layout header has a FuzzyCat logo link pointing to /owner/payments
    const logoLink = page.getByRole('link', { name: /fuzzycat/i });
    await expect(logoLink).toBeVisible();
    await expect(logoLink).toHaveAttribute('href', '/owner/payments');
  });

  test('captures screenshot of settings page', async ({ page }, testInfo) => {
    // Wait for all sections to load
    await page.waitForLoadState('networkidle');

    await testInfo.attach('settings-page-full', {
      body: await page.screenshot({ fullPage: true }),
      contentType: 'image/png',
    });
  });
});
