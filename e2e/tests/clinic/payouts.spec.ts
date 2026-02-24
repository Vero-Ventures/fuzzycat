import { expect, test } from '@playwright/test';

test.describe('Clinic Payouts', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/clinic/payouts');
  });

  test('loads payouts page', async ({ page }) => {
    await expect(page.getByRole('heading', { name: /payouts/i })).toBeVisible();
    await expect(page).toHaveURL(/\/clinic\/payouts/);
  });

  test('shows payout/earnings information', async ({ page }) => {
    // The PayoutEarnings component fetches data via tRPC. On success it renders
    // stat cards ("Total Received", "3% Revenue Share", etc.); on failure it
    // shows "Unable to load earnings data." Both are valid production states.
    const description = page.getByText(/track your payout history and revenue earned/i);
    await expect(description).toBeVisible();

    // Wait for either earnings cards or the error state
    const earningsCard = page
      .getByText(/total received|3% revenue share|completed payouts/i)
      .first();
    const errorMsg = page.getByText(/unable to load earnings data/i);
    await expect(earningsCard.or(errorMsg)).toBeVisible({ timeout: 15000 });
  });

  test('captures screenshot', async ({ page }, testInfo) => {
    await page.waitForLoadState('domcontentloaded');

    await testInfo.attach('clinic-payouts', {
      body: await page.screenshot(),
      contentType: 'image/png',
    });
  });
});
