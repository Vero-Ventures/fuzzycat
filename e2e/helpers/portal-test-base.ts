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
import { _ensureRouteInstalled, mockTrpcQuery } from './trpc-mock';

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
 * Install the tRPC mock route handler for any unmocked procedures.
 *
 * In the registry-based mock system, this is a no-op when specific mocks
 * have already been registered (the route handler auto-installs on first
 * `mockTrpcQuery`/`mockTrpcMutation` call). When called without prior mocks,
 * it installs the handler so unmocked procedures return safe defaults
 * (`null` for queries, `{ success: true }` for mutations).
 *
 * Safe to call before or after specific mocks — order does not matter.
 */
export async function mockAllTrpc(page: Page) {
  await _ensureRouteInstalled(page);
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
 * Open the mobile hamburger menu if it exists (i.e. the viewport is narrow enough
 * for the sidebar to be collapsed into a slide-out drawer).
 *
 * Both `AdminSidebar` and `ClinicSidebar` render a button with
 * `aria-label="Open menu"` that is only visible on viewports below the `md`
 * breakpoint. This helper clicks that button and waits for the sidebar to
 * slide open so that nav links become interactable.
 *
 * Safe to call on desktop viewports — the button won't be visible and the
 * helper simply returns without doing anything.
 */
export async function openMobileMenuIfNeeded(page: Page) {
  const openMenuBtn = page.locator('button[aria-label="Open menu"]');
  if (await openMenuBtn.isVisible({ timeout: 2000 }).catch(() => false)) {
    await openMenuBtn.click();
    // Wait for the slide-out animation to complete
    await page.waitForTimeout(500);
  }
}

/**
 * Navigate to a portal page with standard waits.
 * Returns `true` if the portal page loaded successfully, `false` if
 * the page was redirected to /login (auth cookies missing).
 * Callers should skip the test when this returns `false`.
 */
export async function gotoPortalPage(page: Page, url: string): Promise<boolean> {
  try {
    await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 30000 });
  } catch {
    // Retry once if navigation was aborted (redirect race)
    await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 30000 });
  }

  // If we were redirected to /login, auth cookies are missing
  if (page.url().includes('/login')) {
    return false;
  }

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
  return true;
}
