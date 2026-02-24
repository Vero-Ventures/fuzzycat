import { expect, test } from '@playwright/test';

test.describe('Admin Payments', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/admin/payments');
  });

  test('shows payment list section', async ({ page }) => {
    // The payment list card should be visible with filter tabs,
    // even if the API call fails and no table rows are shown
    await expect(page.getByRole('tab', { name: /all/i })).toBeVisible({ timeout: 10000 });
    await expect(page.getByRole('tab', { name: /pending/i })).toBeVisible();
    await expect(page.getByRole('tab', { name: /succeeded/i })).toBeVisible();
    await expect(page.getByRole('tab', { name: /failed/i })).toBeVisible();
  });

  test('captures screenshot', async ({ page }, testInfo) => {
    await page.waitForLoadState('domcontentloaded');

    const screenshot = await page.screenshot({ fullPage: true });
    await testInfo.attach('admin-payments', {
      body: screenshot,
      contentType: 'image/png',
    });
  });
});
