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
    // The ProfileForm card uses CardTitle (a div, not a heading) with text "Profile Information"
    const profileTitle = page.getByText(/profile information/i);
    const profileFallback = page.getByText(/unable to load profile information/i);

    // Either the profile form or an error fallback should be visible
    await expect(profileTitle.or(profileFallback)).toBeVisible({
      timeout: 15000,
    });
  });

  test('has payment method section', async ({ page }) => {
    // The PaymentMethodSection card uses CardDescription with this text — wait for it to confirm the section loaded
    await expect(page.getByText(/choose how your installment payments are collected/i)).toBeVisible(
      { timeout: 15000 },
    );

    // The CardTitle "Payment Method" should also be visible (as a div, not a heading)
    // Use exact: true to distinguish from the page description that also contains "payment method"
    await expect(page.getByText('Payment Method', { exact: true })).toBeVisible();
  });

  test('has active plans section', async ({ page }) => {
    // The ActivePlansSection card uses CardTitle (a div, not a heading) with text "Payment Plans"
    const plansTitle = page.getByText(/payment plans/i).first();

    await expect(plansTitle).toBeVisible({ timeout: 15000 });

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
    // Wait for client-side sections to render (Payment Method title appears after tRPC resolves)
    await expect(page.getByText(/payment method/i).first()).toBeVisible({ timeout: 15000 });

    await testInfo.attach('settings-page-full', {
      body: await page.screenshot({ fullPage: true }),
      contentType: 'image/png',
    });
  });
});
