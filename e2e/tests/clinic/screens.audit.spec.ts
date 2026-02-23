import { expect, test } from '@playwright/test';
import {
  clinicClients,
  clinicDashboardStats,
  clinicDefaultRate,
  clinicEnrollmentTrends,
  clinicMonthlyRevenue,
  clinicOnboardingStatus,
  clinicProfile,
  clinicRevenueReport,
  payoutEarnings,
  payoutHistory,
} from '../../helpers/audit-mock-data';
import { takeScreenshot } from '../../helpers/screenshot';
import { mockTrpcQuery } from '../../helpers/trpc-mock';

const SUBDIR = 'clinic';

// Portal pages involve SSR + Supabase auth — allow extra time
test.describe.configure({ timeout: 90_000 });

/** Navigate to a clinic portal page, assert not redirected to login, wait for hydration. */
async function gotoPortalPage(page: import('@playwright/test').Page, url: string) {
  await page.goto(url, { waitUntil: 'domcontentloaded' });
  expect(page.url()).not.toContain('/login');
  await expect(page.getByRole('link', { name: /fuzzycat/i }).first()).toBeVisible({
    timeout: 15000,
  });
  // Allow React Query hydration + mock interception
  await page.waitForTimeout(2000);
}

test.describe('UI Audit: Clinic Portal', () => {
  test('Dashboard — KPI cards, recent enrollments, revenue (US-C2)', async ({ page }, testInfo) => {
    await mockTrpcQuery(page, 'clinic.getDashboardStats', clinicDashboardStats);
    await mockTrpcQuery(page, 'clinic.getMonthlyRevenue', clinicMonthlyRevenue);

    await gotoPortalPage(page, '/clinic/dashboard');

    // US-C2: KPI cards or dashboard content
    const activePlans = page.getByText('12').or(page.getByText(/active plan/i));
    if (
      await activePlans
        .first()
        .isVisible({ timeout: 5000 })
        .catch(() => false)
    ) {
      test.info().annotations.push({ type: 'pass', description: 'US-C2: Dashboard stats visible' });
    } else {
      test.info().annotations.push({
        type: 'finding',
        description: 'US-C2: Dashboard stats not rendered — likely #151',
      });
    }

    // #150: Check "Initiate Enrollment" button link target
    const enrollBtn = page.getByRole('link', { name: /initiate.*enrollment|new.*enrollment/i });
    if (await enrollBtn.isVisible({ timeout: 3000 }).catch(() => false)) {
      const href = await enrollBtn.getAttribute('href');
      if (href?.includes('/owner/enroll')) {
        test.info().annotations.push({
          type: 'bug',
          description: '#150: Initiate Enrollment links to /owner/enroll instead of /clinic/enroll',
        });
      }
    }

    await takeScreenshot(page, testInfo, 'clinic-dashboard-full', SUBDIR);
  });

  test('Clients page — client list table, search, filters (US-C3)', async ({ page }, testInfo) => {
    await mockTrpcQuery(page, 'clinic.getClients', clinicClients);

    await gotoPortalPage(page, '/clinic/clients');

    const clientTable = page
      .locator('table')
      .or(page.locator('[role="table"]'))
      .or(page.getByText(/jane doe/i));
    if (
      await clientTable
        .first()
        .isVisible({ timeout: 5000 })
        .catch(() => false)
    ) {
      test.info().annotations.push({ type: 'pass', description: 'US-C3: Client list visible' });
    }

    await takeScreenshot(page, testInfo, 'clinic-clients-full', SUBDIR);
  });

  test('Payouts page — earnings summary, payout history (US-C4)', async ({ page }, testInfo) => {
    await mockTrpcQuery(page, 'payout.earnings', payoutEarnings);
    await mockTrpcQuery(page, 'payout.history', payoutHistory);

    await gotoPortalPage(page, '/clinic/payouts');

    const earningsSection = page
      .getByText(/earnings|total.*payout|payout.*summary/i)
      .or(page.getByText(/\$75,600/))
      .or(page.getByRole('heading', { name: /payout/i }));
    if (
      await earningsSection
        .first()
        .isVisible({ timeout: 5000 })
        .catch(() => false)
    ) {
      test.info().annotations.push({ type: 'pass', description: 'US-C4: Payout data visible' });
    }

    await takeScreenshot(page, testInfo, 'clinic-payouts-full', SUBDIR);
  });

  test('Reports page — revenue reports, enrollment trends, default rate (US-C5)', async ({
    page,
  }, testInfo) => {
    await mockTrpcQuery(page, 'clinic.getRevenueReport', clinicRevenueReport);
    await mockTrpcQuery(page, 'clinic.getEnrollmentTrends', clinicEnrollmentTrends);
    await mockTrpcQuery(page, 'clinic.getDefaultRate', clinicDefaultRate);

    await gotoPortalPage(page, '/clinic/reports');

    const reportsHeading = page
      .getByRole('heading', { name: /report/i })
      .or(page.getByText(/revenue/i));
    if (
      await reportsHeading
        .first()
        .isVisible({ timeout: 5000 })
        .catch(() => false)
    ) {
      test.info().annotations.push({ type: 'pass', description: 'US-C5: Reports visible' });
    }

    await takeScreenshot(page, testInfo, 'clinic-reports-full', SUBDIR);
  });

  test('Settings page — profile form, Stripe Connect section (US-C1)', async ({
    page,
  }, testInfo) => {
    await mockTrpcQuery(page, 'clinic.getProfile', clinicProfile);

    await gotoPortalPage(page, '/clinic/settings');

    const profileSection = page
      .getByRole('heading', { name: /settings|profile/i })
      .or(page.getByText(/happy paws/i));
    if (
      await profileSection
        .first()
        .isVisible({ timeout: 5000 })
        .catch(() => false)
    ) {
      test.info().annotations.push({ type: 'pass', description: 'US-C1: Settings visible' });
    }

    await takeScreenshot(page, testInfo, 'clinic-settings-full', SUBDIR);
  });

  test('Onboarding page — checklist, Stripe Connect step (US-C1)', async ({ page }, testInfo) => {
    await mockTrpcQuery(page, 'clinic.getOnboardingStatus', clinicOnboardingStatus);

    await gotoPortalPage(page, '/clinic/onboarding');

    const onboardingHeading = page
      .getByRole('heading', { name: /onboarding|welcome|get started/i })
      .or(page.getByText(/onboarding/i));
    if (
      await onboardingHeading
        .first()
        .isVisible({ timeout: 5000 })
        .catch(() => false)
    ) {
      test.info().annotations.push({ type: 'pass', description: 'US-C1: Onboarding visible' });
    }

    await takeScreenshot(page, testInfo, 'clinic-onboarding-full', SUBDIR);
  });

  test('Clinic Enrollment page — clinic-initiated enrollment form', async ({ page }, testInfo) => {
    await mockTrpcQuery(page, 'clinic.getProfile', clinicProfile);

    await page.route('**/challenges.cloudflare.com/**', (route) =>
      route.fulfill({
        status: 200,
        contentType: 'application/javascript',
        body: 'window.turnstile = { render: function(el, opts) { if (opts && opts.callback) opts.callback("mock-token"); return "mock-id"; }, reset: function() {}, remove: function() {} };',
      }),
    );

    await gotoPortalPage(page, '/clinic/enroll');

    // This page may not exist yet — capture whatever renders (404 or form)
    const pageContent = page
      .getByRole('heading', { name: /enroll|new.*plan|not found/i })
      .or(page.getByText(/enroll|not found|404/i));
    if (
      await pageContent
        .first()
        .isVisible({ timeout: 5000 })
        .catch(() => false)
    ) {
      test.info().annotations.push({ type: 'pass', description: 'Clinic enroll page renders' });
    }

    await takeScreenshot(page, testInfo, 'clinic-enroll-form', SUBDIR);
  });
});
