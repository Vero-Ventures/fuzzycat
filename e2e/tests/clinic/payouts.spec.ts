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
    // The PayoutEarnings component renders stat cards like "Total Received",
    // "3% Revenue Share", "Pending", "Completed Payouts" — or loading skeletons.
    // The page description also mentions payouts and revenue.
    const description = page.getByText(/track your payout history and revenue earned/i);
    await expect(description).toBeVisible();

    // Wait for at least one earnings card or skeleton to appear
    const cards = page.locator('.rounded-xl.border');
    await expect(cards.first()).toBeVisible({ timeout: 10000 });
  });

  test('captures screenshot', async ({ page }, testInfo) => {
    await page.waitForLoadState('domcontentloaded');

    await testInfo.attach('clinic-payouts', {
      body: await page.screenshot(),
      contentType: 'image/png',
    });
  });
});
