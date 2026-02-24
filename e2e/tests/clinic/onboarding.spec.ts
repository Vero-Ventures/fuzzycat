import { expect, test } from '@playwright/test';

test.describe('Clinic Onboarding', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/clinic/onboarding');
  });

  test('loads onboarding page', async ({ page }) => {
    await expect(page.getByRole('heading', { name: /welcome to fuzzycat/i })).toBeVisible();
    await expect(page).toHaveURL(/\/clinic\/onboarding/);
  });

  test('shows onboarding checklist', async ({ page }) => {
    // The checklist has three steps: profile, Stripe, and MFA
    // These may show as loaded cards or loading skeletons
    const profileStep = page.getByText(/complete your profile/i);
    await expect(profileStep).toBeVisible({ timeout: 10000 });

    const stripeStep = page.getByText(/connect your bank account/i);
    await expect(stripeStep).toBeVisible({ timeout: 10000 });

    const mfaStep = page.getByText(/enable two-factor authentication/i);
    await expect(mfaStep).toBeVisible({ timeout: 10000 });
  });

  test('shows description', async ({ page }) => {
    const description = page.getByText(
      /complete the steps below to start offering guaranteed payment plans/i,
    );
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
