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

// Portal pages involve SSR + Supabase auth — allow extra time
test.describe.configure({ timeout: 90_000 });

/** Navigate to an admin portal page, assert not redirected to login, wait for hydration. */
async function gotoPortalPage(page: import('@playwright/test').Page, url: string) {
  await page.goto(url, { waitUntil: 'domcontentloaded' });
  expect(page.url()).not.toContain('/login');
  await expect(page.getByRole('link', { name: /fuzzycat/i }).first()).toBeVisible({
    timeout: 15000,
  });
  // Allow React Query hydration + mock interception
  await page.waitForTimeout(2000);
}

test.describe('UI Audit: Admin Portal', () => {
  test('Dashboard — GMV, revenue, defaults KPIs, audit log (US-A1, A5)', async ({
    page,
  }, testInfo) => {
    await mockTrpcQuery(page, 'admin.getPlatformStats', adminPlatformStats);
    await mockTrpcQuery(page, 'admin.riskPoolHealth', adminRiskPoolHealth);
    await mockTrpcQuery(page, 'admin.getRecentAuditLog', adminRecentAuditLog);

    await gotoPortalPage(page, '/admin/dashboard');

    // US-A5: Platform stats KPIs
    const enrollments = page.getByText('234').or(page.getByText(/total.*enrollment/i));
    if (
      await enrollments
        .first()
        .isVisible({ timeout: 5000 })
        .catch(() => false)
    ) {
      test.info().annotations.push({ type: 'pass', description: 'US-A5: Platform stats visible' });
    } else {
      test.info().annotations.push({
        type: 'finding',
        description: 'US-A5: Platform stats not rendered — likely #151',
      });
    }

    // US-A1: Audit log entries
    const auditLog = page
      .getByText(/audit.*log|recent.*activity/i)
      .or(page.getByText(/status_changed/i))
      .or(page.getByText(/disclaimer_confirmed/i));
    if (
      await auditLog
        .first()
        .isVisible({ timeout: 5000 })
        .catch(() => false)
    ) {
      test.info().annotations.push({ type: 'pass', description: 'US-A1: Audit log visible' });
    }

    await takeScreenshot(page, testInfo, 'admin-dashboard-full', SUBDIR);
  });

  test('Clinics page — clinic list, status management (US-A3)', async ({ page }, testInfo) => {
    await mockTrpcQuery(page, 'admin.getClinics', adminClinics);

    await gotoPortalPage(page, '/admin/clinics');

    const clinicList = page
      .locator('table')
      .or(page.locator('[role="table"]'))
      .or(page.getByText(/happy paws/i));
    if (
      await clinicList
        .first()
        .isVisible({ timeout: 5000 })
        .catch(() => false)
    ) {
      test.info().annotations.push({ type: 'pass', description: 'US-A3: Clinic list visible' });
    }

    await takeScreenshot(page, testInfo, 'admin-clinics-full', SUBDIR);
  });

  test('Payments page — payment failures, retry functionality (US-A2)', async ({
    page,
  }, testInfo) => {
    await mockTrpcQuery(page, 'admin.getPayments', adminPayments);

    await gotoPortalPage(page, '/admin/payments');

    const paymentList = page
      .locator('table')
      .or(page.locator('[role="table"]'))
      .or(page.getByText(/bob williams/i));
    if (
      await paymentList
        .first()
        .isVisible({ timeout: 5000 })
        .catch(() => false)
    ) {
      test.info().annotations.push({ type: 'pass', description: 'US-A2: Payment list visible' });
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

    await gotoPortalPage(page, '/admin/risk');

    const riskPool = page.getByText(/risk pool/i).or(page.getByRole('heading', { name: /risk/i }));
    if (
      await riskPool
        .first()
        .isVisible({ timeout: 5000 })
        .catch(() => false)
    ) {
      test.info().annotations.push({ type: 'pass', description: 'US-A4: Risk pool visible' });
    }

    await takeScreenshot(page, testInfo, 'admin-risk-full', SUBDIR);
  });
});
