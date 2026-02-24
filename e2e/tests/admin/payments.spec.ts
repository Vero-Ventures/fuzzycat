import { expect, test } from '@playwright/test';

test.describe('Admin Payments', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/admin/payments');
  });

  test('loads payments page', async ({ page }) => {
    await expect(page).toHaveURL(/\/admin\/payments/);
    await expect(page.getByRole('heading', { name: /payments/i })).toBeVisible();
  });

  test('shows payment list', async ({ page }) => {
    // The page should display a list or table of payments
    const paymentList = page.locator(
      'table, [data-testid="payment-list"], [class*="payment-list"], ul, [role="table"]',
    );
    await expect(paymentList.first()).toBeVisible({ timeout: 10000 });
  });

  test('shows page description', async ({ page }) => {
    // The page should have descriptive text about tracking payments
    const description = page.getByText(
      /track.*payment|payment.*track|view.*payment|payment.*overview|monitor.*payment/i,
    );
    await expect(description.first()).toBeVisible({ timeout: 10000 });
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
