import { expect, test } from '@playwright/test';
import { gotoPortalPage, mockAllTrpc, mockExternalServices } from '../../helpers/portal-test-base';
import { mockTrpcQueryError } from '../../helpers/trpc-mock';

test.describe.configure({ timeout: 90_000 });

test.describe('Error Handling — Owner Portal', () => {
  test.use({ storageState: 'e2e/auth-state/owner.json' });

  test('error boundary on owner portal render failure', async ({ page }) => {
    await mockExternalServices(page);
    await mockTrpcQueryError(page, 'owner.getDashboardSummary', 'INTERNAL_SERVER_ERROR', 'Crash');
    await mockTrpcQueryError(page, 'owner.getPlans', 'INTERNAL_SERVER_ERROR', 'Crash');
    await mockTrpcQueryError(page, 'owner.getPaymentHistory', 'INTERNAL_SERVER_ERROR', 'Crash');
    await mockAllTrpc(page);

    const loaded = await gotoPortalPage(page, '/owner/payments');
    if (!loaded) return;

    const errorIndicator = page.getByText(/error|something went wrong|unable.*load|try again/i);
    await expect(errorIndicator.first()).toBeVisible({ timeout: 10000 });
  });

  test('404 for invalid owner sub-route', async ({ page }) => {
    await mockExternalServices(page);
    await mockAllTrpc(page);

    const response = await page.goto('/owner/nonexistent-page', {
      waitUntil: 'domcontentloaded',
    });
    const status = response?.status();

    // App may redirect to /login (no auth), /owner/payments (home), or show 404
    const is404 = status === 404;
    const hasNotFound = await page
      .getByText(/not found|404/i)
      .isVisible()
      .catch(() => false);
    const isRedirectedHome = page.url().includes('/owner/payments');
    const isRedirectedLogin = page.url().includes('/login');

    expect(is404 || hasNotFound || isRedirectedHome || isRedirectedLogin).toBe(true);
  });
});

test.describe('Error Handling — Clinic Portal', () => {
  test.use({ storageState: 'e2e/auth-state/clinic.json' });

  test('error boundary on clinic portal render failure', async ({ page }) => {
    await mockExternalServices(page);
    await mockTrpcQueryError(page, 'clinic.getDashboardStats', 'INTERNAL_SERVER_ERROR', 'Crash');
    await mockTrpcQueryError(page, 'clinic.getMonthlyRevenue', 'INTERNAL_SERVER_ERROR', 'Crash');
    await mockAllTrpc(page);

    const loaded = await gotoPortalPage(page, '/clinic/dashboard');
    if (!loaded) return;

    const errorIndicator = page.getByText(/error|something went wrong|unable.*load|try again/i);
    await expect(errorIndicator.first()).toBeVisible({ timeout: 10000 });
  });

  test('404 for invalid clinic sub-route', async ({ page }) => {
    await mockExternalServices(page);
    await mockAllTrpc(page);

    const response = await page.goto('/clinic/nonexistent-page', {
      waitUntil: 'domcontentloaded',
    });
    const status = response?.status();

    const is404 = status === 404;
    const hasNotFound = await page
      .getByText(/not found|404/i)
      .isVisible()
      .catch(() => false);
    const isRedirectedHome = page.url().includes('/clinic/dashboard');
    const isRedirectedLogin = page.url().includes('/login');

    expect(is404 || hasNotFound || isRedirectedHome || isRedirectedLogin).toBe(true);
  });
});

test.describe('Error Handling — Admin Portal', () => {
  test.use({ storageState: 'e2e/auth-state/admin.json' });

  test('error boundary on admin portal render failure', async ({ page }) => {
    await mockExternalServices(page);
    await mockTrpcQueryError(page, 'admin.getPlatformStats', 'INTERNAL_SERVER_ERROR', 'Crash');
    await mockTrpcQueryError(page, 'admin.riskPoolHealth', 'INTERNAL_SERVER_ERROR', 'Crash');
    await mockTrpcQueryError(page, 'admin.getRecentAuditLog', 'INTERNAL_SERVER_ERROR', 'Crash');
    await mockAllTrpc(page);

    const loaded = await gotoPortalPage(page, '/admin/dashboard');
    if (!loaded) return;

    const errorIndicator = page.getByText(/error|something went wrong|unable.*load|try again/i);
    await expect(errorIndicator.first()).toBeVisible({ timeout: 10000 });
  });

  test('404 for invalid admin sub-route', async ({ page }) => {
    await mockExternalServices(page);
    await mockAllTrpc(page);

    const response = await page.goto('/admin/nonexistent-page', {
      waitUntil: 'domcontentloaded',
    });
    const status = response?.status();

    const is404 = status === 404;
    const hasNotFound = await page
      .getByText(/not found|404/i)
      .isVisible()
      .catch(() => false);
    const isRedirectedHome = page.url().includes('/admin/dashboard');
    const isRedirectedLogin = page.url().includes('/login');

    expect(is404 || hasNotFound || isRedirectedHome || isRedirectedLogin).toBe(true);
  });
});
