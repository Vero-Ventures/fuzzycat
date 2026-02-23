import type { Page } from '@playwright/test';
import { expect } from '@playwright/test';
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
  clinicClients,
  clinicDashboardStats,
  clinicDefaultRate,
  clinicEnrollmentTrends,
  clinicMonthlyRevenue,
  clinicOnboardingStatus,
  clinicProfile,
  clinicRevenueReport,
  clinicSearch,
  ownerDashboardSummary,
  ownerPaymentHistory,
  ownerPlans,
  ownerProfile,
  payoutEarnings,
  payoutHistory,
} from './audit-mock-data';
import { mockTrpcQuery } from './trpc-mock';

/**
 * Pre-configure all tRPC mocks for a given portal role.
 * This enables portal tests to run in CI without real Supabase auth.
 */
export async function setupPortalMocks(page: Page, role: 'owner' | 'clinic' | 'admin') {
  switch (role) {
    case 'owner':
      await mockTrpcQuery(page, 'owner.getDashboardSummary', ownerDashboardSummary);
      await mockTrpcQuery(page, 'owner.getPlans', ownerPlans);
      await mockTrpcQuery(page, 'owner.getPaymentHistory', ownerPaymentHistory);
      await mockTrpcQuery(page, 'owner.getProfile', ownerProfile);
      await mockTrpcQuery(page, 'clinic.search', clinicSearch);
      break;
    case 'clinic':
      await mockTrpcQuery(page, 'clinic.getDashboardStats', clinicDashboardStats);
      await mockTrpcQuery(page, 'clinic.getMonthlyRevenue', clinicMonthlyRevenue);
      await mockTrpcQuery(page, 'clinic.getClients', clinicClients);
      await mockTrpcQuery(page, 'clinic.getProfile', clinicProfile);
      await mockTrpcQuery(page, 'clinic.getOnboardingStatus', clinicOnboardingStatus);
      await mockTrpcQuery(page, 'clinic.getRevenueReport', clinicRevenueReport);
      await mockTrpcQuery(page, 'clinic.getEnrollmentTrends', clinicEnrollmentTrends);
      await mockTrpcQuery(page, 'clinic.getDefaultRate', clinicDefaultRate);
      await mockTrpcQuery(page, 'payout.earnings', payoutEarnings);
      await mockTrpcQuery(page, 'payout.history', payoutHistory);
      break;
    case 'admin':
      await mockTrpcQuery(page, 'admin.getPlatformStats', adminPlatformStats);
      await mockTrpcQuery(page, 'admin.riskPoolHealth', adminRiskPoolHealth);
      await mockTrpcQuery(page, 'admin.getRecentAuditLog', adminRecentAuditLog);
      await mockTrpcQuery(page, 'admin.getClinics', adminClinics);
      await mockTrpcQuery(page, 'admin.getPayments', adminPayments);
      await mockTrpcQuery(page, 'admin.riskPoolBalance', adminRiskPoolBalance);
      await mockTrpcQuery(page, 'admin.getRiskPoolDetails', adminRiskPoolDetails);
      await mockTrpcQuery(page, 'admin.getSoftCollections', adminSoftCollections);
      await mockTrpcQuery(page, 'admin.getDefaultedPlans', adminDefaultedPlans);
      await mockTrpcQuery(page, 'admin.getSoftCollectionStats', adminSoftCollectionStats);
      break;
  }
}

/**
 * Catch-all route for any unmocked tRPC procedure.
 * Returns empty defaults so tests don't hang on unexpected queries.
 * Must be called AFTER specific mocks (Playwright routes match in registration order).
 */
export async function mockAllTrpc(page: Page) {
  await page.route('**/api/trpc/**', async (route, request) => {
    if (request.method() === 'GET') {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify([{ result: { data: null } }]),
      });
    } else if (request.method() === 'POST') {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify([{ result: { data: { success: true } } }]),
      });
    } else {
      await route.fallback();
    }
  });
}

/**
 * Mock all external services (Stripe, Plaid, Turnstile, analytics) at the network layer.
 */
export async function mockExternalServices(page: Page) {
  await page.route('**/js.stripe.com/**', (route) =>
    route.fulfill({
      status: 200,
      contentType: 'application/javascript',
      body: 'window.Stripe = function() { return { elements: function() { return { create: function() { return { mount: function() {}, on: function() {} } } } }, confirmPayment: function() { return Promise.resolve({ paymentIntent: { status: "succeeded" } }) }, confirmSetup: function() { return Promise.resolve({ setupIntent: { status: "succeeded" } }) } } };',
    }),
  );
  await page.route('**/cdn.plaid.com/**', (route) =>
    route.fulfill({
      status: 200,
      contentType: 'application/javascript',
      body: 'window.Plaid = { create: function() { return { open: function() {}, exit: function() {}, destroy: function() {} } } };',
    }),
  );
  await page.route('**/challenges.cloudflare.com/**', (route) =>
    route.fulfill({
      status: 200,
      contentType: 'application/javascript',
      body: 'window.turnstile = { render: function(el, opts) { if (opts && opts.callback) opts.callback("mock-turnstile-token"); return "mock-widget-id"; }, reset: function() {}, remove: function() {} };',
    }),
  );
  await page.route('**/us.i.posthog.com/**', (route) => route.fulfill({ status: 200, body: '{}' }));
  await page.route('**/*.ingest.sentry.io/**', (route) =>
    route.fulfill({ status: 200, body: '{}' }),
  );
  await page.route('**/browser.sentry-cdn.com/**', (route) =>
    route.fulfill({ status: 200, contentType: 'application/javascript', body: '' }),
  );
}

/**
 * Navigate to a portal page with standard waits.
 * Asserts the page is not redirected to /login and waits for hydration.
 */
export async function gotoPortalPage(page: Page, url: string) {
  try {
    await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 30000 });
  } catch {
    // Retry once if navigation was aborted (redirect race)
    await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 30000 });
  }
  expect(page.url()).not.toContain('/login');

  // Wait for portal chrome to render (use .first() to avoid strict mode violation
  // when both Sign Out button and FuzzyCat link are present)
  await expect(
    page
      .getByRole('button', { name: /sign out/i })
      .or(page.getByRole('link', { name: /fuzzycat/i }))
      .first(),
  ).toBeVisible({ timeout: 15000 });

  // Allow React Query hydration + mock interception
  await page.waitForTimeout(2000);
}
