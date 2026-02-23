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

// Portal pages involve SSR + Supabase auth — allow extra time
test.describe.configure({ timeout: 90_000 });

test.describe('UI Audit: Owner Portal', () => {
  test('Payments page — dashboard summary, plan list, payment history (US-O1, O2, O4, O6)', async ({
    page,
  }, testInfo) => {
    await mockTrpcQuery(page, 'owner.getDashboardSummary', ownerDashboardSummary);
    await mockTrpcQuery(page, 'owner.getPlans', ownerPlans);
    await mockTrpcQuery(page, 'owner.getPaymentHistory', ownerPaymentHistory);

    // Owner payments is the landing page — navigation may be interrupted by redirects
    try {
      await page.goto('/owner/payments', { waitUntil: 'domcontentloaded', timeout: 30000 });
    } catch {
      // Retry once if navigation was aborted (redirect race)
      await page.goto('/owner/payments', { waitUntil: 'domcontentloaded', timeout: 30000 });
    }
    expect(page.url()).not.toContain('/login');

    // Wait for hydration — portal header or main content should appear
    await expect(page.getByRole('button', { name: /sign out/i })).toBeVisible({ timeout: 15000 });

    // Allow time for React Query to populate via mocks
    await page.waitForTimeout(2000);

    // US-O1: Next payment date + amount
    const nextPayment = page.getByText(/next payment/i).or(page.getByText(/\$106/));
    if (
      await nextPayment
        .first()
        .isVisible({ timeout: 5000 })
        .catch(() => false)
    ) {
      test.info().annotations.push({ type: 'pass', description: 'US-O1: Next payment visible' });
    } else {
      test.info().annotations.push({
        type: 'finding',
        description: 'US-O1: Next payment not visible — likely #151 tRPC identity issue',
      });
    }

    // US-O4: Pet name + clinic name in plan list
    if (
      await page
        .getByText(/happy paws/i)
        .first()
        .isVisible({ timeout: 3000 })
        .catch(() => false)
    ) {
      test.info().annotations.push({ type: 'pass', description: 'US-O4: Plan data rendered' });
    } else {
      test.info().annotations.push({
        type: 'finding',
        description: 'US-O4: Plan data not visible — mocks may not be intercepted or #151',
      });
    }

    await takeScreenshot(page, testInfo, 'owner-payments-full', SUBDIR);
  });

  test('Settings page — profile info, payment method (US-O5)', async ({ page }, testInfo) => {
    await mockTrpcQuery(page, 'owner.getProfile', ownerProfile);
    await mockTrpcQuery(page, 'owner.getPlans', ownerPlans);

    await page.goto('/owner/settings', { waitUntil: 'domcontentloaded' });
    expect(page.url()).not.toContain('/login');

    await expect(page.getByRole('button', { name: /sign out/i })).toBeVisible({ timeout: 15000 });

    await page.waitForTimeout(2000);

    // Profile/Settings heading
    const profileSection = page
      .getByText(/jane doe/i)
      .or(page.getByText(/profile/i))
      .or(page.getByRole('heading', { name: /settings/i }));
    if (
      await profileSection
        .first()
        .isVisible({ timeout: 5000 })
        .catch(() => false)
    ) {
      test.info().annotations.push({ type: 'pass', description: 'US-O5: Profile section visible' });
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

    await page.goto('/owner/enroll', { waitUntil: 'domcontentloaded' });
    expect(page.url()).not.toContain('/login');

    await expect(page.getByRole('button', { name: /sign out/i })).toBeVisible({ timeout: 15000 });

    await page.waitForTimeout(2000);

    // Enrollment wizard should render
    const enrollHeading = page
      .getByRole('heading', { name: /enroll|payment plan|create.*plan/i })
      .or(page.getByText(/step 1/i))
      .or(page.getByText(/find your vet/i))
      .or(page.getByText(/pay your vet bill/i));
    if (
      await enrollHeading
        .first()
        .isVisible({ timeout: 5000 })
        .catch(() => false)
    ) {
      test
        .info()
        .annotations.push({ type: 'pass', description: 'US-O3: Enrollment wizard visible' });
    }

    await takeScreenshot(page, testInfo, 'owner-enroll-wizard', SUBDIR);
  });

  test('Enrollment Success page — confirmation details (US-O3)', async ({ page }, testInfo) => {
    await mockTrpcQuery(page, 'enrollment.getSummary', enrollmentSummary);

    await page.goto('/owner/enroll/success?planId=plan-new-001', {
      waitUntil: 'domcontentloaded',
    });
    expect(page.url()).not.toContain('/login');

    await expect(page.getByRole('button', { name: /sign out/i })).toBeVisible({ timeout: 15000 });

    await page.waitForTimeout(2000);

    await takeScreenshot(page, testInfo, 'owner-enroll-success', SUBDIR);
  });
});
