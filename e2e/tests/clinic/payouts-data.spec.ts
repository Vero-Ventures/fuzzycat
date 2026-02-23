import { expect, test } from '@playwright/test';
import {
  emptyPayoutEarnings,
  emptyPayoutHistory,
  payoutEarnings,
  payoutHistory,
} from '../../helpers/audit-mock-data';
import { gotoPortalPage, mockAllTrpc } from '../../helpers/portal-test-base';
import { mockTrpcQuery } from '../../helpers/trpc-mock';

test.describe.configure({ timeout: 90_000 });

test.describe('Clinic Payouts — Data Assertions', () => {
  test('earnings summary values render', async ({ page }) => {
    await mockTrpcQuery(page, 'payout.earnings', payoutEarnings);
    await mockTrpcQuery(page, 'payout.history', payoutHistory);
    await mockAllTrpc(page);

    await gotoPortalPage(page, '/clinic/payouts');

    // Total payout: $75,600.00
    await expect(page.getByText(/\$75,600/).first()).toBeVisible({ timeout: 5000 });
  });

  test('payout history table renders', async ({ page }) => {
    await mockTrpcQuery(page, 'payout.earnings', payoutEarnings);
    await mockTrpcQuery(page, 'payout.history', payoutHistory);
    await mockAllTrpc(page);

    await gotoPortalPage(page, '/clinic/payouts');

    // Table should be visible
    const table = page.locator('table').or(page.locator('[role="table"]'));
    await expect(table.first()).toBeVisible({ timeout: 5000 });

    // Payout amounts from mock data
    await expect(page.getByText(/\$1,060/).first()).toBeVisible({ timeout: 5000 });
  });

  test('empty state: no payouts', async ({ page }) => {
    await mockTrpcQuery(page, 'payout.earnings', emptyPayoutEarnings);
    await mockTrpcQuery(page, 'payout.history', emptyPayoutHistory);
    await mockAllTrpc(page);

    await gotoPortalPage(page, '/clinic/payouts');

    const empty = page.getByText(/no.*payout|payout.*will appear/i);
    await expect(empty.first()).toBeVisible({ timeout: 5000 });
  });

  test('pending vs succeeded styling', async ({ page }) => {
    await mockTrpcQuery(page, 'payout.earnings', payoutEarnings);
    await mockTrpcQuery(page, 'payout.history', payoutHistory);
    await mockAllTrpc(page);

    await gotoPortalPage(page, '/clinic/payouts');

    // Both succeeded and pending statuses should be visible
    await expect(page.getByText(/succeeded/i).first()).toBeVisible({ timeout: 5000 });
    await expect(page.getByText(/pending/i).first()).toBeVisible({ timeout: 5000 });
  });
});
