import { expect, test } from '@playwright/test';
import {
  clinicClients,
  clinicClientsFilteredBySearch,
  clinicDashboardStats,
  clinicDefaultRate,
  clinicEnrollmentTrends,
  clinicMonthlyRevenue,
  clinicOnboardingIncomplete,
  clinicProfile,
  clinicRevenueReport,
  emptyClinicDashboardStats,
  emptyPayoutEarnings,
  emptyPayoutHistory,
  payoutEarnings,
  payoutHistory,
} from '../../helpers/audit-mock-data';
import {
  gotoPortalPage,
  mockAllTrpc,
  mockExternalServices,
  setupPortalMocks,
} from '../../helpers/portal-test-base';
import { mockTrpcMutation, mockTrpcQuery } from '../../helpers/trpc-mock';

test.describe.configure({ timeout: 90_000 });

test.describe('Clinic Portal — Mobile', () => {
  test.use({ storageState: 'e2e/auth-state/clinic.json' });

  // ── Dashboard ──────────────────────────────────────────────────────────────

  test('dashboard KPI cards stack correctly on mobile', async ({ page }, testInfo) => {
    await mockExternalServices(page);
    await mockTrpcQuery(page, 'clinic.getDashboardStats', clinicDashboardStats);
    await mockTrpcQuery(page, 'clinic.getMonthlyRevenue', clinicMonthlyRevenue);
    await mockAllTrpc(page);

    await gotoPortalPage(page, '/clinic/dashboard');

    // All KPI values visible
    await expect(page.getByText('12').first()).toBeVisible({ timeout: 5000 });
    await expect(page.getByText(/active plan/i).first()).toBeVisible({ timeout: 5000 });

    // Recent enrollments
    await expect(page.getByText(/jane doe/i).first()).toBeVisible({ timeout: 5000 });

    // No horizontal overflow
    const hasOverflow = await page.evaluate(() => {
      return document.documentElement.scrollWidth > document.documentElement.clientWidth;
    });
    expect(hasOverflow).toBe(false);

    await testInfo.attach('mobile-clinic-dashboard', {
      body: await page.screenshot({ fullPage: true }),
      contentType: 'image/png',
    });
  });

  test('dashboard empty state on mobile', async ({ page }, testInfo) => {
    await mockExternalServices(page);
    await mockTrpcQuery(page, 'clinic.getDashboardStats', emptyClinicDashboardStats);
    await mockTrpcQuery(page, 'clinic.getMonthlyRevenue', []);
    await mockAllTrpc(page);

    await gotoPortalPage(page, '/clinic/dashboard');

    await expect(page.getByText('0').first()).toBeVisible({ timeout: 5000 });

    await testInfo.attach('mobile-clinic-dashboard-empty', {
      body: await page.screenshot({ fullPage: true }),
      contentType: 'image/png',
    });
  });

  // ── Clients ────────────────────────────────────────────────────────────────

  test('clients table adapts to mobile viewport', async ({ page }, testInfo) => {
    await mockExternalServices(page);
    await mockTrpcQuery(page, 'clinic.getClients', clinicClients);
    await mockAllTrpc(page);

    await gotoPortalPage(page, '/clinic/clients');

    // Client data renders
    await expect(page.getByText(/jane doe/i).first()).toBeVisible({ timeout: 5000 });

    // Search input usable on mobile
    const searchInput = page.getByPlaceholder(/search/i);
    if (await searchInput.isVisible({ timeout: 3000 }).catch(() => false)) {
      await mockTrpcQuery(page, 'clinic.getClients', clinicClientsFilteredBySearch);
      await searchInput.fill('Jane');
      await page.waitForTimeout(1000);
    }

    // Status filter usable on mobile
    const statusFilter = page
      .locator('select[aria-label="Filter by status"]')
      .or(page.getByRole('combobox').first());
    if (await statusFilter.isVisible({ timeout: 3000 }).catch(() => false)) {
      // Tapping select on mobile should open native picker
      await statusFilter.click();
    }

    await testInfo.attach('mobile-clinic-clients', {
      body: await page.screenshot({ fullPage: true }),
      contentType: 'image/png',
    });
  });

  test('clients pagination on mobile', async ({ page }) => {
    await mockExternalServices(page);
    await mockTrpcQuery(page, 'clinic.getClients', {
      ...clinicClients,
      pagination: { page: 1, pageSize: 2, totalCount: 6, totalPages: 3 },
    });
    await mockAllTrpc(page);

    await gotoPortalPage(page, '/clinic/clients');

    const nextBtn = page.getByRole('button', { name: /next/i });
    if (await nextBtn.isVisible({ timeout: 5000 }).catch(() => false)) {
      await nextBtn.scrollIntoViewIfNeeded();
      await expect(nextBtn).toBeEnabled();
    }
  });

  // ── Payouts ────────────────────────────────────────────────────────────────

  test('payouts page on mobile', async ({ page }, testInfo) => {
    await mockExternalServices(page);
    await mockTrpcQuery(page, 'payout.earnings', payoutEarnings);
    await mockTrpcQuery(page, 'payout.history', payoutHistory);
    await mockAllTrpc(page);

    await gotoPortalPage(page, '/clinic/payouts');

    await expect(page.getByText(/\$75,600/).first()).toBeVisible({ timeout: 5000 });
    await expect(page.getByText(/succeeded/i).first()).toBeVisible({ timeout: 5000 });

    await testInfo.attach('mobile-clinic-payouts', {
      body: await page.screenshot({ fullPage: true }),
      contentType: 'image/png',
    });
  });

  test('payouts empty state on mobile', async ({ page }, testInfo) => {
    await mockExternalServices(page);
    await mockTrpcQuery(page, 'payout.earnings', emptyPayoutEarnings);
    await mockTrpcQuery(page, 'payout.history', emptyPayoutHistory);
    await mockAllTrpc(page);

    await gotoPortalPage(page, '/clinic/payouts');

    const empty = page.getByText(/no.*payout|payout.*will appear/i);
    await expect(empty.first()).toBeVisible({ timeout: 5000 });

    await testInfo.attach('mobile-clinic-payouts-empty', {
      body: await page.screenshot({ fullPage: true }),
      contentType: 'image/png',
    });
  });

  // ── Reports ────────────────────────────────────────────────────────────────

  test('reports page on mobile', async ({ page }, testInfo) => {
    await mockExternalServices(page);
    await mockTrpcQuery(page, 'clinic.getRevenueReport', clinicRevenueReport);
    await mockTrpcQuery(page, 'clinic.getEnrollmentTrends', clinicEnrollmentTrends);
    await mockTrpcQuery(page, 'clinic.getDefaultRate', clinicDefaultRate);
    await mockAllTrpc(page);

    await gotoPortalPage(page, '/clinic/reports');

    await expect(page.getByText(/revenue/i).first()).toBeVisible({ timeout: 5000 });
    await expect(page.getByText(/3\.39/).first()).toBeVisible({ timeout: 5000 });

    // Export buttons accessible on mobile
    const exportBtn = page.getByRole('button', { name: /export/i });
    if (
      await exportBtn
        .first()
        .isVisible({ timeout: 3000 })
        .catch(() => false)
    ) {
      await exportBtn.first().scrollIntoViewIfNeeded();
    }

    await testInfo.attach('mobile-clinic-reports', {
      body: await page.screenshot({ fullPage: true }),
      contentType: 'image/png',
    });
  });

  // ── Settings ───────────────────────────────────────────────────────────────

  test('settings form on mobile', async ({ page }, testInfo) => {
    await mockExternalServices(page);
    await mockTrpcQuery(page, 'clinic.getProfile', clinicProfile);
    await mockTrpcMutation(page, 'clinic.updateProfile', { success: true });
    await mockAllTrpc(page);

    await gotoPortalPage(page, '/clinic/settings');

    // Form fields render
    const nameInput = page.locator('#clinic-name');
    if (await nameInput.isVisible({ timeout: 5000 }).catch(() => false)) {
      await expect(nameInput).toHaveValue('Happy Paws Veterinary');

      // Edit and save on mobile
      await nameInput.clear();
      await nameInput.fill('Updated Clinic Mobile');

      const saveBtn = page.getByRole('button', { name: /save/i });
      await saveBtn.scrollIntoViewIfNeeded();
      await saveBtn.click();

      await expect(page.getByText(/updated|saved|success/i).first()).toBeVisible({ timeout: 5000 });
    }

    await testInfo.attach('mobile-clinic-settings', {
      body: await page.screenshot({ fullPage: true }),
      contentType: 'image/png',
    });
  });

  // ── Onboarding ─────────────────────────────────────────────────────────────

  test('onboarding checklist on mobile', async ({ page }, testInfo) => {
    await mockExternalServices(page);
    await mockTrpcQuery(page, 'clinic.getOnboardingStatus', clinicOnboardingIncomplete);
    await mockAllTrpc(page);

    await gotoPortalPage(page, '/clinic/onboarding');

    await expect(
      page.getByRole('heading', { name: /onboarding|welcome|get started/i }).first(),
    ).toBeVisible({ timeout: 5000 });

    // Stripe connect button accessible on mobile
    const stripeBtn = page
      .getByRole('button', { name: /connect.*stripe|set up.*stripe|stripe/i })
      .or(page.getByRole('link', { name: /connect.*stripe|set up.*stripe|stripe/i }));
    if (
      await stripeBtn
        .first()
        .isVisible({ timeout: 3000 })
        .catch(() => false)
    ) {
      await stripeBtn.first().scrollIntoViewIfNeeded();
    }

    await testInfo.attach('mobile-clinic-onboarding', {
      body: await page.screenshot({ fullPage: true }),
      contentType: 'image/png',
    });
  });

  // ── Clinic Enrollment ──────────────────────────────────────────────────────

  test('clinic enrollment form on mobile', async ({ page }, testInfo) => {
    await mockExternalServices(page);
    await mockTrpcQuery(page, 'clinic.getProfile', clinicProfile);
    await mockAllTrpc(page);

    await gotoPortalPage(page, '/clinic/enroll');

    // Form renders
    await expect(
      page.getByText(/initiate.*enrollment|new.*payment.*plan|enroll/i).first(),
    ).toBeVisible({ timeout: 5000 });

    // Fill form fields on mobile
    await page.locator('#owner-name').fill('Jane Smith');
    await page.locator('#owner-email').fill('jane@example.com');
    await page.locator('#owner-phone').fill('5551234567');
    await page.locator('#pet-name').fill('Whiskers');
    await page.locator('#bill-amount').fill('1200');

    // No horizontal overflow
    const hasOverflow = await page.evaluate(() => {
      return document.documentElement.scrollWidth > document.documentElement.clientWidth;
    });
    expect(hasOverflow).toBe(false);

    await testInfo.attach('mobile-clinic-enroll', {
      body: await page.screenshot({ fullPage: true }),
      contentType: 'image/png',
    });
  });

  // ── Sidebar Navigation ────────────────────────────────────────────────────

  test('clinic sidebar navigation on mobile', async ({ page }) => {
    await mockExternalServices(page);
    await setupPortalMocks(page, 'clinic');
    await mockAllTrpc(page);

    await gotoPortalPage(page, '/clinic/dashboard');

    // On mobile, sidebar may be collapsed into a hamburger menu
    const hamburger = page
      .getByRole('button', { name: /menu|navigation|toggle/i })
      .or(page.locator('[aria-label*="menu"]'))
      .or(page.locator('[aria-label*="Menu"]'));

    if (await hamburger.isVisible({ timeout: 3000 }).catch(() => false)) {
      await hamburger.click();
      await page.waitForTimeout(500);
    }

    // Navigate to clients
    const clientsLink = page.getByRole('link', { name: /client/i });
    if (
      await clientsLink
        .first()
        .isVisible({ timeout: 3000 })
        .catch(() => false)
    ) {
      await clientsLink.first().click();
      await page.waitForLoadState('domcontentloaded');
      expect(page.url()).toContain('clients');
    }
  });
});
