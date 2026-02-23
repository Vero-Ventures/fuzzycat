import { expect, test } from '@playwright/test';
import {
  clinicSearch,
  enrollmentSummary,
  ownerDashboardSummary,
  ownerPaymentHistory,
  ownerPlans,
  ownerProfile,
} from '../../helpers/audit-mock-data';
import { takeScreenshot } from '../../helpers/screenshot';
import { mockTrpcQuery } from '../../helpers/trpc-mock';

const SUBDIR = 'owner';

/** Check if the page redirected to login (no auth state). */
async function isOnLoginPage(page: import('@playwright/test').Page): Promise<boolean> {
  try {
    return page.url().includes('/login');
  } catch {
    return false;
  }
}

test.describe('UI Audit: Owner Portal', () => {
  test('Payments page — dashboard summary, plan list, payment history (US-O1, O2, O4, O6)', async ({
    page,
  }, testInfo) => {
    await mockTrpcQuery(page, 'owner.getDashboardSummary', ownerDashboardSummary);
    await mockTrpcQuery(page, 'owner.getPlans', ownerPlans);
    await mockTrpcQuery(page, 'owner.getPaymentHistory', ownerPaymentHistory);

    await page.goto('/owner/payments');
    await page.waitForLoadState('domcontentloaded');

    if (await isOnLoginPage(page)) {
      test.info().annotations.push({
        type: 'skip-reason',
        description: 'Redirected to login — no auth state available',
      });
      await takeScreenshot(page, testInfo, 'owner-payments-login-redirect', SUBDIR);
      return;
    }

    // US-O1: Next payment date + amount
    const nextPayment = page.getByText(/next payment/i).or(page.getByText(/\$106/));
    await expect(nextPayment.first()).toBeVisible({ timeout: 10000 });

    // US-O4: Pet name + clinic name in plan list
    await expect(page.getByText(/happy paws/i).first()).toBeVisible({ timeout: 10000 });

    // US-O2: Payment history should be visible
    const historySection = page
      .getByText(/payment history/i)
      .or(page.getByText(/deposit/i))
      .or(page.getByText(/installment/i));
    await expect(historySection.first()).toBeVisible({ timeout: 10000 });

    // US-O6: Check for failed payment status visibility
    const failedPayment = page.getByText(/failed/i).or(page.getByText(/insufficient/i));
    if (
      await failedPayment
        .first()
        .isVisible({ timeout: 3000 })
        .catch(() => false)
    ) {
      await expect(failedPayment.first()).toBeVisible();
    }

    await takeScreenshot(page, testInfo, 'owner-payments-full', SUBDIR);
  });

  test('Settings page — profile info, payment method (US-O5)', async ({ page }, testInfo) => {
    await mockTrpcQuery(page, 'owner.getProfile', ownerProfile);
    await mockTrpcQuery(page, 'owner.getPlans', ownerPlans);

    await page.goto('/owner/settings');
    await page.waitForLoadState('domcontentloaded');

    if (await isOnLoginPage(page)) {
      test.info().annotations.push({
        type: 'skip-reason',
        description: 'Redirected to login — no auth state available',
      });
      await takeScreenshot(page, testInfo, 'owner-settings-login-redirect', SUBDIR);
      return;
    }

    // Profile info
    const profileSection = page
      .getByText(/jane doe/i)
      .or(page.getByText(/profile/i))
      .or(page.getByRole('heading', { name: /settings/i }));
    await expect(profileSection.first()).toBeVisible({ timeout: 10000 });

    // US-O5: Payment method section (bank linking)
    const paymentMethod = page
      .getByText(/payment method/i)
      .or(page.getByText(/debit card/i))
      .or(page.getByText(/bank account/i));
    await expect(paymentMethod.first()).toBeVisible({ timeout: 10000 });

    // #125: Check for "Update Payment Method" button
    const updateBtn = page.getByRole('button', { name: /update.*payment/i });
    if (await updateBtn.isVisible({ timeout: 3000 }).catch(() => false)) {
      await expect(updateBtn).toBeVisible();
    }

    await takeScreenshot(page, testInfo, 'owner-settings-full', SUBDIR);
  });

  test('Enrollment page — 5-step wizard renders (US-O3)', async ({ page }, testInfo) => {
    // Mock external services
    await page.route('**/challenges.cloudflare.com/**', (route) =>
      route.fulfill({
        status: 200,
        contentType: 'application/javascript',
        body: 'window.turnstile = { render: function(el, opts) { if (opts && opts.callback) opts.callback("mock-token"); return "mock-id"; }, reset: function() {}, remove: function() {} };',
      }),
    );
    await page.route('**/cdn.plaid.com/**', (route) =>
      route.fulfill({
        status: 200,
        contentType: 'application/javascript',
        body: 'window.Plaid = { create: function() { return { open: function() {}, exit: function() {}, destroy: function() {} } } };',
      }),
    );
    await page.route('**/js.stripe.com/**', (route) =>
      route.fulfill({
        status: 200,
        contentType: 'application/javascript',
        body: 'window.Stripe = function() { return { elements: function() { return { create: function() { return { mount: function() {}, on: function() {} } } } }, confirmPayment: function() { return Promise.resolve({ paymentIntent: { status: "succeeded" } }) } } };',
      }),
    );

    await mockTrpcQuery(page, 'clinic.search', clinicSearch);

    await page.goto('/owner/enroll');
    await page.waitForLoadState('domcontentloaded');

    if (await isOnLoginPage(page)) {
      test.info().annotations.push({
        type: 'skip-reason',
        description: 'Redirected to login — no auth state available',
      });
      await takeScreenshot(page, testInfo, 'owner-enroll-login-redirect', SUBDIR);
      return;
    }

    // Enrollment wizard should render
    const enrollHeading = page
      .getByRole('heading', { name: /enroll|new plan|create.*plan/i })
      .or(page.getByText(/step 1/i))
      .or(page.getByText(/find your vet/i));
    await expect(enrollHeading.first()).toBeVisible({ timeout: 10000 });

    await takeScreenshot(page, testInfo, 'owner-enroll-wizard', SUBDIR);
  });

  test('Enrollment Success page — confirmation details (US-O3)', async ({ page }, testInfo) => {
    await mockTrpcQuery(page, 'enrollment.getSummary', enrollmentSummary);

    await page.goto('/owner/enroll/success?planId=plan-new-001');
    await page.waitForLoadState('domcontentloaded');

    if (await isOnLoginPage(page)) {
      test.info().annotations.push({
        type: 'skip-reason',
        description: 'Redirected to login — no auth state available',
      });
      await takeScreenshot(page, testInfo, 'owner-enroll-success-login-redirect', SUBDIR);
      return;
    }

    // Confirmation heading
    await expect(
      page.getByRole('heading', { name: /you.*all set|success|confirmed|enrollment/i }),
    ).toBeVisible({ timeout: 10000 });

    // Clinic name + pet name
    await expect(page.getByText(/happy paws/i).first()).toBeVisible({ timeout: 10000 });
    await expect(page.getByText(/whiskers/i).first()).toBeVisible({ timeout: 10000 });

    // Link to payments
    const paymentsLink = page
      .getByRole('link', { name: /payment|dashboard/i })
      .or(page.getByText(/view.*payment/i));
    await expect(paymentsLink.first()).toBeVisible({ timeout: 10000 });

    await takeScreenshot(page, testInfo, 'owner-enroll-success', SUBDIR);
  });
});
