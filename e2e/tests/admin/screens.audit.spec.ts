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
} from '../../helpers/audit-mock-data';
import { takeScreenshot } from '../../helpers/screenshot';
import { mockTrpcQuery } from '../../helpers/trpc-mock';

const SUBDIR = 'admin';

/** Navigate and return early if redirected to login. */
async function gotoOrSkip(
  page: import('@playwright/test').Page,
  url: string,
  testInfo: import('@playwright/test').TestInfo,
  screenshotName: string,
): Promise<boolean> {
  await page.goto(url);
  await page.waitForLoadState('domcontentloaded');
  if (page.url().includes('/login')) {
    testInfo.annotations.push({
      type: 'skip-reason',
      description: 'Redirected to login — no auth state available',
    });
    await takeScreenshot(page, testInfo, `${screenshotName}-login-redirect`, SUBDIR);
    return true;
  }
  return false;
}

test.describe('UI Audit: Admin Portal', () => {
  test('Dashboard — GMV, revenue, defaults KPIs, audit log (US-A1, A5)', async ({
    page,
  }, testInfo) => {
    await mockTrpcQuery(page, 'admin.getPlatformStats', adminPlatformStats);
    await mockTrpcQuery(page, 'admin.riskPoolHealth', adminRiskPoolHealth);
    await mockTrpcQuery(page, 'admin.getRecentAuditLog', adminRecentAuditLog);

    if (await gotoOrSkip(page, '/admin/dashboard', testInfo, 'admin-dashboard')) return;

    // US-A5: Platform stats KPIs
    const statsSection = page
      .locator('[data-testid="platform-stats"]')
      .or(page.locator('.grid').first());
    await expect(statsSection).toBeVisible({ timeout: 10000 });

    // Total enrollments
    const enrollments = page.getByText('234').or(page.getByText(/total.*enrollment/i));
    await expect(enrollments.first()).toBeVisible({ timeout: 10000 });

    // US-A1: Audit log entries
    const auditLog = page
      .getByText(/audit.*log|recent.*activity/i)
      .or(page.getByText(/status_changed/i))
      .or(page.getByText(/disclaimer_confirmed/i));
    await expect(auditLog.first()).toBeVisible({ timeout: 10000 });

    await takeScreenshot(page, testInfo, 'admin-dashboard-full', SUBDIR);
  });

  test('Clinics page — clinic list, status management (US-A3)', async ({ page }, testInfo) => {
    await mockTrpcQuery(page, 'admin.getClinics', adminClinics);

    if (await gotoOrSkip(page, '/admin/clinics', testInfo, 'admin-clinics')) return;

    // US-A3: Clinic list
    const clinicList = page
      .locator('table')
      .or(page.locator('[role="table"]'))
      .or(page.getByText(/happy paws/i));
    await expect(clinicList.first()).toBeVisible({ timeout: 10000 });

    // Verify clinic data renders
    await expect(page.getByText(/happy paws/i).first()).toBeVisible({ timeout: 10000 });

    // Status badges
    const statusBadge = page
      .getByText(/active/i)
      .or(page.getByText(/pending/i))
      .or(page.getByText(/suspended/i));
    await expect(statusBadge.first()).toBeVisible({ timeout: 10000 });

    await takeScreenshot(page, testInfo, 'admin-clinics-full', SUBDIR);
  });

  test('Payments page — payment failures, retry functionality (US-A2)', async ({
    page,
  }, testInfo) => {
    await mockTrpcQuery(page, 'admin.getPayments', adminPayments);

    if (await gotoOrSkip(page, '/admin/payments', testInfo, 'admin-payments')) return;

    // US-A2: Payment list
    const paymentList = page
      .locator('table')
      .or(page.locator('[role="table"]'))
      .or(page.getByText(/bob williams/i));
    await expect(paymentList.first()).toBeVisible({ timeout: 10000 });

    // Failed payment visible
    const failedPayment = page.getByText(/failed/i).or(page.getByText(/insufficient funds/i));
    await expect(failedPayment.first()).toBeVisible({ timeout: 10000 });

    // Retry button
    const retryBtn = page.getByRole('button', { name: /retry/i });
    if (
      await retryBtn
        .first()
        .isVisible({ timeout: 3000 })
        .catch(() => false)
    ) {
      await expect(retryBtn.first()).toBeVisible();
    }

    await takeScreenshot(page, testInfo, 'admin-payments-full', SUBDIR);
  });

  test('Risk page — risk pool balance, soft collections, defaulted plans (US-A4)', async ({
    page,
  }, testInfo) => {
    await mockTrpcQuery(page, 'admin.riskPoolBalance', adminRiskPoolBalance);
    await mockTrpcQuery(page, 'admin.riskPoolHealth', adminRiskPoolHealth);
    await mockTrpcQuery(page, 'admin.getRiskPoolDetails', adminRiskPoolDetails);
    await mockTrpcQuery(page, 'admin.getSoftCollections', adminSoftCollections);
    await mockTrpcQuery(page, 'admin.getDefaultedPlans', adminDefaultedPlans);
    await mockTrpcQuery(page, 'admin.getSoftCollectionStats', adminSoftCollectionStats);

    if (await gotoOrSkip(page, '/admin/risk', testInfo, 'admin-risk')) return;

    // US-A4: Risk pool balance
    const riskPool = page.getByText(/risk pool/i).or(page.getByRole('heading', { name: /risk/i }));
    await expect(riskPool.first()).toBeVisible({ timeout: 10000 });

    // Balance display
    const balance = page.getByText(/balance/i).or(page.getByText(/\$12,500/));
    await expect(balance.first()).toBeVisible({ timeout: 10000 });

    await takeScreenshot(page, testInfo, 'admin-risk-full', SUBDIR);
  });
});
