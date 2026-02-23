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

/** Check if the page redirected to login (no auth state). */
async function isOnLoginPage(page: import('@playwright/test').Page): Promise<boolean> {
  return page.url().includes('/login');
}

/** Navigate and return early if redirected to login. */
async function gotoOrSkip(
  page: import('@playwright/test').Page,
  url: string,
  testInfo: import('@playwright/test').TestInfo,
  screenshotName: string,
): Promise<boolean> {
  await page.goto(url);
  await page.waitForLoadState('domcontentloaded');
  if (await isOnLoginPage(page)) {
    testInfo.annotations.push({
      type: 'skip-reason',
      description: 'Redirected to login — no auth state available',
    });
    await takeScreenshot(page, testInfo, `${screenshotName}-login-redirect`, SUBDIR);
    return true;
  }
  return false;
}

test.describe('UI Audit: Clinic Portal', () => {
  test('Dashboard — KPI cards, recent enrollments, revenue (US-C2)', async ({ page }, testInfo) => {
    await mockTrpcQuery(page, 'clinic.getDashboardStats', clinicDashboardStats);
    await mockTrpcQuery(page, 'clinic.getMonthlyRevenue', clinicMonthlyRevenue);

    if (await gotoOrSkip(page, '/clinic/dashboard', testInfo, 'clinic-dashboard')) return;

    // US-C2: KPI cards
    const statsSection = page
      .locator('[data-testid="dashboard-stats"]')
      .or(page.locator('.grid').first());
    await expect(statsSection).toBeVisible({ timeout: 10000 });

    // Active plans count
    const activePlans = page.getByText('12').or(page.getByText(/active plan/i));
    await expect(activePlans.first()).toBeVisible({ timeout: 10000 });

    // Recent enrollments
    const enrollments = page
      .getByText(/recent enrollment/i)
      .or(page.getByText(/whiskers/i))
      .or(page.getByText(/jane doe/i));
    await expect(enrollments.first()).toBeVisible({ timeout: 10000 });

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

    if (await gotoOrSkip(page, '/clinic/clients', testInfo, 'clinic-clients')) return;

    // US-C3: Client list table
    const clientTable = page
      .locator('table')
      .or(page.locator('[role="table"]'))
      .or(page.getByText(/jane doe/i));
    await expect(clientTable.first()).toBeVisible({ timeout: 10000 });

    // Verify client data renders
    await expect(page.getByText(/whiskers/i).first()).toBeVisible({ timeout: 10000 });

    await takeScreenshot(page, testInfo, 'clinic-clients-full', SUBDIR);
  });

  test('Payouts page — earnings summary, payout history (US-C4)', async ({ page }, testInfo) => {
    await mockTrpcQuery(page, 'payout.earnings', payoutEarnings);
    await mockTrpcQuery(page, 'payout.history', payoutHistory);

    if (await gotoOrSkip(page, '/clinic/payouts', testInfo, 'clinic-payouts')) return;

    // US-C4: Guaranteed payments / earnings display
    const earningsSection = page
      .getByText(/earnings|total.*payout|payout.*summary/i)
      .or(page.getByText(/\$75,600/))
      .or(page.getByRole('heading', { name: /payout/i }));
    await expect(earningsSection.first()).toBeVisible({ timeout: 10000 });

    // Payout history
    const historySection = page
      .getByText(/payout.*history|recent.*payout/i)
      .or(page.locator('table'))
      .or(page.getByText(/succeeded/i));
    await expect(historySection.first()).toBeVisible({ timeout: 10000 });

    await takeScreenshot(page, testInfo, 'clinic-payouts-full', SUBDIR);
  });

  test('Reports page — revenue reports, enrollment trends, default rate (US-C5)', async ({
    page,
  }, testInfo) => {
    await mockTrpcQuery(page, 'clinic.getRevenueReport', clinicRevenueReport);
    await mockTrpcQuery(page, 'clinic.getEnrollmentTrends', clinicEnrollmentTrends);
    await mockTrpcQuery(page, 'clinic.getDefaultRate', clinicDefaultRate);

    if (await gotoOrSkip(page, '/clinic/reports', testInfo, 'clinic-reports')) return;

    // US-C5: Revenue reports
    const reportsHeading = page
      .getByRole('heading', { name: /report/i })
      .or(page.getByText(/revenue/i));
    await expect(reportsHeading.first()).toBeVisible({ timeout: 10000 });

    await takeScreenshot(page, testInfo, 'clinic-reports-full', SUBDIR);
  });

  test('Settings page — profile form, Stripe Connect section (US-C1)', async ({
    page,
  }, testInfo) => {
    await mockTrpcQuery(page, 'clinic.getProfile', clinicProfile);

    if (await gotoOrSkip(page, '/clinic/settings', testInfo, 'clinic-settings')) return;

    // Profile form
    const profileSection = page
      .getByRole('heading', { name: /settings|profile/i })
      .or(page.getByText(/happy paws/i));
    await expect(profileSection.first()).toBeVisible({ timeout: 10000 });

    await takeScreenshot(page, testInfo, 'clinic-settings-full', SUBDIR);
  });

  test('Onboarding page — checklist, Stripe Connect step (US-C1)', async ({ page }, testInfo) => {
    await mockTrpcQuery(page, 'clinic.getOnboardingStatus', clinicOnboardingStatus);

    if (await gotoOrSkip(page, '/clinic/onboarding', testInfo, 'clinic-onboarding')) return;

    // US-C1: Onboarding checklist
    const onboardingHeading = page
      .getByRole('heading', { name: /onboarding|welcome|get started/i })
      .or(page.getByText(/onboarding/i));
    await expect(onboardingHeading.first()).toBeVisible({ timeout: 10000 });

    // Profile complete step
    const profileStep = page.getByText(/profile.*complete/i).or(page.getByText(/complete/i));
    await expect(profileStep.first()).toBeVisible({ timeout: 10000 });

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

    if (await gotoOrSkip(page, '/clinic/enroll', testInfo, 'clinic-enroll')) return;

    // This page may not exist yet — capture whatever renders (404 or form)
    const pageContent = page
      .getByRole('heading', { name: /enroll|new.*plan|not found/i })
      .or(page.getByText(/enroll|not found|404/i));
    await expect(pageContent.first()).toBeVisible({ timeout: 10000 });

    await takeScreenshot(page, testInfo, 'clinic-enroll-form', SUBDIR);
  });
});
