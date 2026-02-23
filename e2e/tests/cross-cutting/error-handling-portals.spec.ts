import { expect, test } from '@playwright/test';
import { gotoPortalPage, mockAllTrpc, mockExternalServices } from '../../helpers/portal-test-base';
import { mockTrpcQueryError } from '../../helpers/trpc-mock';

test.describe.configure({ timeout: 90_000 });

test.describe('Error Handling — Portals', () => {
  test('error boundary on owner portal render failure', async ({ page }) => {
    await mockExternalServices(page);
    // Mock all queries with errors
    await mockTrpcQueryError(page, 'owner.getDashboardSummary', 'INTERNAL_SERVER_ERROR', 'Crash');
    await mockTrpcQueryError(page, 'owner.getPlans', 'INTERNAL_SERVER_ERROR', 'Crash');
    await mockTrpcQueryError(page, 'owner.getPaymentHistory', 'INTERNAL_SERVER_ERROR', 'Crash');
    await mockAllTrpc(page);

    await gotoPortalPage(page, '/owner/payments');

    // Should show error boundary or error message — not a blank page
    const errorIndicator = page.getByText(/error|something went wrong|unable.*load|try again/i);
    await expect(errorIndicator.first()).toBeVisible({ timeout: 10000 });
  });

  test('error boundary on clinic portal render failure', async ({ page }) => {
    await mockExternalServices(page);
    await mockTrpcQueryError(page, 'clinic.getDashboardStats', 'INTERNAL_SERVER_ERROR', 'Crash');
    await mockTrpcQueryError(page, 'clinic.getMonthlyRevenue', 'INTERNAL_SERVER_ERROR', 'Crash');
    await mockAllTrpc(page);

    await gotoPortalPage(page, '/clinic/dashboard');

    const errorIndicator = page.getByText(/error|something went wrong|unable.*load|try again/i);
    await expect(errorIndicator.first()).toBeVisible({ timeout: 10000 });
  });

  test('error boundary on admin portal render failure', async ({ page }) => {
    await mockExternalServices(page);
    await mockTrpcQueryError(page, 'admin.getPlatformStats', 'INTERNAL_SERVER_ERROR', 'Crash');
    await mockTrpcQueryError(page, 'admin.riskPoolHealth', 'INTERNAL_SERVER_ERROR', 'Crash');
    await mockTrpcQueryError(page, 'admin.getRecentAuditLog', 'INTERNAL_SERVER_ERROR', 'Crash');
    await mockAllTrpc(page);

    await gotoPortalPage(page, '/admin/dashboard');

    const errorIndicator = page.getByText(/error|something went wrong|unable.*load|try again/i);
    await expect(errorIndicator.first()).toBeVisible({ timeout: 10000 });
  });

  test('404 for invalid owner sub-route', async ({ page }) => {
    await mockExternalServices(page);
    await mockAllTrpc(page);

    const response = await page.goto('/owner/nonexistent-page');
    const is404 = response?.status() === 404;
    const hasNotFound = await page
      .getByText(/not found|404/i)
      .isVisible()
      .catch(() => false);

    expect(is404 || hasNotFound).toBe(true);
  });

  test('404 for invalid clinic sub-route', async ({ page }) => {
    await mockExternalServices(page);
    await mockAllTrpc(page);

    const response = await page.goto('/clinic/nonexistent-page');
    const is404 = response?.status() === 404;
    const hasNotFound = await page
      .getByText(/not found|404/i)
      .isVisible()
      .catch(() => false);

    expect(is404 || hasNotFound).toBe(true);
  });

  test('404 for invalid admin sub-route', async ({ page }) => {
    await mockExternalServices(page);
    await mockAllTrpc(page);

    const response = await page.goto('/admin/nonexistent-page');
    const is404 = response?.status() === 404;
    const hasNotFound = await page
      .getByText(/not found|404/i)
      .isVisible()
      .catch(() => false);

    expect(is404 || hasNotFound).toBe(true);
  });
});
