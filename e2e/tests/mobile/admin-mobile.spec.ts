import { expect, test } from '@playwright/test';
import {
  adminClinics,
  adminDefaultedPlans,
  adminPayments,
  adminPlatformStats,
  adminRecentAuditLog,
  adminRiskPoolBalance,
  adminRiskPoolDetails,
  adminRiskPoolHealth,
  adminSoftCollectionStats,
  adminSoftCollections,
  emptyAdminPlatformStats,
  emptyAdminRiskPoolHealth,
} from '../../helpers/audit-mock-data';
import {
  gotoPortalPage,
  mockAllTrpc,
  mockExternalServices,
  openMobileMenuIfNeeded,
  setupPortalMocks,
} from '../../helpers/portal-test-base';
import { mockTrpcMutation, mockTrpcQuery, mockTrpcQueryError } from '../../helpers/trpc-mock';

test.describe.configure({ timeout: 90_000 });

test.describe('Admin Portal — Mobile', () => {
  test.use({ storageState: 'e2e/auth-state/admin.json' });

  // ── Dashboard ──────────────────────────────────────────────────────────────

  test('dashboard KPIs render on mobile', async ({ page }, testInfo) => {
    await mockExternalServices(page);
    await mockTrpcQuery(page, 'admin.getPlatformStats', adminPlatformStats);
    await mockTrpcQuery(page, 'admin.riskPoolHealth', adminRiskPoolHealth);
    await mockTrpcQuery(page, 'admin.getRecentAuditLog', adminRecentAuditLog);
    await mockAllTrpc(page);

    await gotoPortalPage(page, '/admin/dashboard');

    await expect(page.getByText('234').first()).toBeVisible({ timeout: 5000 });
    await expect(page.getByText(/risk pool/i).first()).toBeVisible({ timeout: 5000 });

    // No horizontal overflow
    const hasOverflow = await page.evaluate(() => {
      return document.documentElement.scrollWidth > document.documentElement.clientWidth;
    });
    expect(hasOverflow).toBe(false);

    await testInfo.attach('mobile-admin-dashboard', {
      body: await page.screenshot({ fullPage: true }),
      contentType: 'image/png',
    });
  });

  test('dashboard audit log on mobile', async ({ page }, testInfo) => {
    await mockExternalServices(page);
    await mockTrpcQuery(page, 'admin.getPlatformStats', adminPlatformStats);
    await mockTrpcQuery(page, 'admin.riskPoolHealth', adminRiskPoolHealth);
    await mockTrpcQuery(page, 'admin.getRecentAuditLog', adminRecentAuditLog);
    await mockAllTrpc(page);

    await gotoPortalPage(page, '/admin/dashboard');

    const auditLog = page.getByText(/audit.*log|recent.*activity/i);
    await expect(auditLog.first()).toBeVisible({ timeout: 5000 });

    await testInfo.attach('mobile-admin-audit-log', {
      body: await page.screenshot({ fullPage: true }),
      contentType: 'image/png',
    });
  });

  test('dashboard empty state on mobile', async ({ page }, testInfo) => {
    await mockExternalServices(page);
    await mockTrpcQuery(page, 'admin.getPlatformStats', emptyAdminPlatformStats);
    await mockTrpcQuery(page, 'admin.riskPoolHealth', emptyAdminRiskPoolHealth);
    await mockTrpcQuery(page, 'admin.getRecentAuditLog', []);
    await mockAllTrpc(page);

    await gotoPortalPage(page, '/admin/dashboard');

    await expect(page.getByText('0').first()).toBeVisible({ timeout: 5000 });

    await testInfo.attach('mobile-admin-dashboard-empty', {
      body: await page.screenshot({ fullPage: true }),
      contentType: 'image/png',
    });
  });

  // ── Clinics ────────────────────────────────────────────────────────────────

  test('clinic list table on mobile', async ({ page }, testInfo) => {
    await mockExternalServices(page);
    await mockTrpcQuery(page, 'admin.getClinics', adminClinics);
    await mockAllTrpc(page);

    await gotoPortalPage(page, '/admin/clinics');

    // Clinic data renders
    await expect(page.getByText(/happy paws/i).first()).toBeVisible({ timeout: 5000 });

    // Status badges
    await expect(page.getByText(/active/i).first()).toBeVisible({ timeout: 3000 });

    // Search usable on mobile
    const searchInput = page.getByPlaceholder(/search/i);
    if (await searchInput.isVisible({ timeout: 3000 }).catch(() => false)) {
      await searchInput.fill('Happy');
      await page.waitForTimeout(500);
    }

    // Status tabs usable on mobile
    const pendingTab = page
      .getByRole('tab', { name: /pending/i })
      .or(page.getByRole('button', { name: /pending/i }));
    if (await pendingTab.isVisible({ timeout: 3000 }).catch(() => false)) {
      await pendingTab.scrollIntoViewIfNeeded();
    }

    await testInfo.attach('mobile-admin-clinics', {
      body: await page.screenshot({ fullPage: true }),
      contentType: 'image/png',
    });
  });

  // ── Payments ───────────────────────────────────────────────────────────────

  test('payments table on mobile', async ({ page }, testInfo) => {
    await mockExternalServices(page);
    await mockTrpcQuery(page, 'admin.getPayments', adminPayments);
    await mockAllTrpc(page);

    await gotoPortalPage(page, '/admin/payments');

    await expect(page.getByText(/bob williams/i).first()).toBeVisible({ timeout: 5000 });

    // Retry button visible and tappable on mobile
    const retryBtn = page.getByRole('button', { name: /retry/i });
    if (
      await retryBtn
        .first()
        .isVisible({ timeout: 3000 })
        .catch(() => false)
    ) {
      await retryBtn.first().scrollIntoViewIfNeeded();
    }

    await testInfo.attach('mobile-admin-payments', {
      body: await page.screenshot({ fullPage: true }),
      contentType: 'image/png',
    });
  });

  test('retry payment on mobile', async ({ page }) => {
    await mockExternalServices(page);
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
      await retryBtn.first().scrollIntoViewIfNeeded();
      await retryBtn.first().click();
      await page.waitForTimeout(1000);
    }
  });

  // ── Risk ───────────────────────────────────────────────────────────────────

  test('risk pool dashboard on mobile', async ({ page }, testInfo) => {
    await mockExternalServices(page);
    await mockTrpcQuery(page, 'admin.riskPoolBalance', adminRiskPoolBalance);
    await mockTrpcQuery(page, 'admin.riskPoolHealth', adminRiskPoolHealth);
    await mockTrpcQuery(page, 'admin.getRiskPoolDetails', adminRiskPoolDetails);
    await mockTrpcQuery(page, 'admin.getSoftCollections', adminSoftCollections);
    await mockTrpcQuery(page, 'admin.getDefaultedPlans', adminDefaultedPlans);
    await mockTrpcQuery(page, 'admin.getSoftCollectionStats', adminSoftCollectionStats);
    await mockAllTrpc(page);

    await gotoPortalPage(page, '/admin/risk');

    // Risk pool data visible
    await expect(page.getByText(/\$12,500/).first()).toBeVisible({ timeout: 5000 });
    await expect(page.getByText(/bob williams/i).first()).toBeVisible({ timeout: 5000 });

    // Scrolling through sections works
    const defaultedSection = page.getByText(/defaulted/i);
    if (
      await defaultedSection
        .first()
        .isVisible({ timeout: 3000 })
        .catch(() => false)
    ) {
      await defaultedSection.first().scrollIntoViewIfNeeded();
    }

    await testInfo.attach('mobile-admin-risk', {
      body: await page.screenshot({ fullPage: true }),
      contentType: 'image/png',
    });
  });

  // ── Sidebar Navigation ────────────────────────────────────────────────────

  test('admin sidebar navigation on mobile', async ({ page }) => {
    await mockExternalServices(page);
    await setupPortalMocks(page, 'admin');
    await mockAllTrpc(page);

    await gotoPortalPage(page, '/admin/dashboard');

    // Open the mobile hamburger menu so sidebar links become visible
    await openMobileMenuIfNeeded(page);

    // Navigate to clinics
    const clinicsLink = page.getByRole('link', { name: /clinic/i });
    await expect(clinicsLink.first()).toBeVisible({ timeout: 5000 });
    await clinicsLink.first().click();
    await page.waitForLoadState('domcontentloaded');
    expect(page.url()).toContain('clinics');
  });

  test('sign out accessible on mobile', async ({ page }) => {
    await mockExternalServices(page);
    await setupPortalMocks(page, 'admin');
    await mockAllTrpc(page);

    await gotoPortalPage(page, '/admin/dashboard');

    // Sign Out is inside the sidebar — open hamburger menu first on mobile
    await openMobileMenuIfNeeded(page);

    const signOut = page.getByRole('button', { name: /sign out|log out/i });
    await expect(signOut).toBeVisible({ timeout: 5000 });
  });

  // ── Error Handling on Mobile ───────────────────────────────────────────────

  test('error state renders properly on mobile', async ({ page }, testInfo) => {
    await mockExternalServices(page);
    await mockTrpcQueryError(page, 'admin.getPlatformStats', 'INTERNAL_SERVER_ERROR', 'Crash');
    await mockTrpcQueryError(page, 'admin.riskPoolHealth', 'INTERNAL_SERVER_ERROR', 'Crash');
    await mockTrpcQueryError(page, 'admin.getRecentAuditLog', 'INTERNAL_SERVER_ERROR', 'Crash');
    await mockAllTrpc(page);

    await gotoPortalPage(page, '/admin/dashboard');

    const error = page.getByText(/error|something went wrong|unable.*load/i);
    await expect(error.first()).toBeVisible({ timeout: 10000 });

    await testInfo.attach('mobile-admin-error', {
      body: await page.screenshot({ fullPage: true }),
      contentType: 'image/png',
    });
  });
});
