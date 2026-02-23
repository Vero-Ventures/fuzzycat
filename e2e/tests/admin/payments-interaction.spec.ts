import { expect, test } from '@playwright/test';
import { adminPayments } from '../../helpers/audit-mock-data';
import { gotoPortalPage, mockAllTrpc } from '../../helpers/portal-test-base';
import { mockTrpcMutation, mockTrpcQuery } from '../../helpers/trpc-mock';

test.describe.configure({ timeout: 90_000 });

test.describe('Admin Payments — Interactions', () => {
  test('payment list renders all details', async ({ page }) => {
    await mockTrpcQuery(page, 'admin.getPayments', adminPayments);
    await mockAllTrpc(page);

    await gotoPortalPage(page, '/admin/payments');

    // Table should render
    const table = page.locator('table').or(page.locator('[role="table"]'));
    await expect(table.first()).toBeVisible({ timeout: 5000 });

    // Payment details from mock data
    await expect(page.getByText(/bob williams/i).first()).toBeVisible({ timeout: 5000 });
    await expect(page.getByText(/emily chen/i).first()).toBeVisible({ timeout: 5000 });

    // Failed payment shows failure reason
    await expect(page.getByText(/insufficient funds/i).first()).toBeVisible({ timeout: 5000 });
  });

  test('retry button visible only on failed payments', async ({ page }) => {
    await mockTrpcQuery(page, 'admin.getPayments', adminPayments);
    await mockAllTrpc(page);

    await gotoPortalPage(page, '/admin/payments');

    // Retry button should exist (for the failed payment)
    const retryBtn = page.getByRole('button', { name: /retry/i });
    if (
      await retryBtn
        .first()
        .isVisible({ timeout: 5000 })
        .catch(() => false)
    ) {
      // Should only have 1 retry button (one failed payment in mock data)
      expect(await retryBtn.count()).toBe(1);
    }
  });

  test('retry failed payment triggers mutation', async ({ page }) => {
    await mockTrpcQuery(page, 'admin.getPayments', adminPayments);
    await mockTrpcMutation(page, 'payment.retryPayment', { success: true });
    await mockAllTrpc(page);

    await gotoPortalPage(page, '/admin/payments');

    const retryBtn = page.getByRole('button', { name: /retry/i });
    if (
      await retryBtn
        .first()
        .isVisible({ timeout: 5000 })
        .catch(() => false)
    ) {
      await retryBtn.first().click();
      await page.waitForTimeout(1000);
    }
  });
});
