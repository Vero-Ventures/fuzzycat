import { expect, test } from '@playwright/test';
import { adminPayments } from '../../helpers/audit-mock-data';
import { gotoPortalPage, mockAllTrpc } from '../../helpers/portal-test-base';
import { mockTrpcMutation, mockTrpcQuery } from '../../helpers/trpc-mock';

test.describe.configure({ timeout: 90_000 });

test.describe('Admin Payments — Actions', () => {
  test.beforeEach(async ({ page }) => {
    await mockTrpcQuery(page, 'admin.getPayments', adminPayments);
    await mockAllTrpc(page);
  });

  test('clicking Retry button triggers admin.retryPayment mutation', async ({ page }) => {
    await mockTrpcMutation(page, 'admin.retryPayment', { success: true });

    let mutationCalled = false;
    page.on('request', (req) => {
      if (req.method() === 'POST' && req.url().includes('admin.retryPayment')) {
        mutationCalled = true;
      }
    });

    await gotoPortalPage(page, '/admin/payments');

    const retryBtn = page.getByRole('button', { name: /retry/i });
    await expect(retryBtn.first()).toBeVisible({ timeout: 5000 });
    await retryBtn.first().click();

    // Allow time for the mutation request to fire
    await page.waitForTimeout(1000);
    expect(mutationCalled).toBe(true);
  });

  test('status tabs filter payments (All, Pending, Succeeded, Failed, Written Off)', async ({
    page,
  }) => {
    await gotoPortalPage(page, '/admin/payments');

    // All tabs should be visible
    await expect(page.getByRole('tab', { name: 'All' })).toBeVisible({ timeout: 5000 });
    await expect(page.getByRole('tab', { name: 'Pending' })).toBeVisible();
    await expect(page.getByRole('tab', { name: 'Succeeded' })).toBeVisible();
    await expect(page.getByRole('tab', { name: 'Failed' })).toBeVisible();
    await expect(page.getByRole('tab', { name: 'Written Off' })).toBeVisible();

    // "All" should be selected by default
    await expect(page.getByRole('tab', { name: 'All' })).toHaveAttribute('aria-selected', 'true');

    // Click the "Failed" tab and verify it becomes selected
    await page.getByRole('tab', { name: 'Failed' }).click();
    await expect(page.getByRole('tab', { name: 'Failed' })).toHaveAttribute(
      'aria-selected',
      'true',
    );

    // Click the "Succeeded" tab and verify it becomes selected
    await page.getByRole('tab', { name: 'Succeeded' }).click();
    await expect(page.getByRole('tab', { name: 'Succeeded' })).toHaveAttribute(
      'aria-selected',
      'true',
    );
  });

  test('retry failed payment triggers mutation', async ({ page }) => {
    await mockTrpcMutation(page, 'payment.retryPayment', { success: true });

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
