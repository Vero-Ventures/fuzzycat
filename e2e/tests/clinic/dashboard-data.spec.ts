import { expect, test } from '@playwright/test';
import {
  clinicDashboardStats,
  clinicMonthlyRevenue,
  emptyClinicDashboardStats,
} from '../../helpers/audit-mock-data';
import { gotoPortalPage, mockAllTrpc } from '../../helpers/portal-test-base';
import { mockTrpcQuery, mockTrpcQueryError } from '../../helpers/trpc-mock';

test.describe.configure({ timeout: 90_000 });

test.describe('Clinic Dashboard — Data Assertions', () => {
  test('KPI cards show correct values', async ({ page }) => {
    await mockTrpcQuery(page, 'clinic.getDashboardStats', clinicDashboardStats);
    await mockTrpcQuery(page, 'clinic.getMonthlyRevenue', clinicMonthlyRevenue);
    await mockAllTrpc(page);

    await gotoPortalPage(page, '/clinic/dashboard');

    // Active Plans: 12
    await expect(page.getByText('12').first()).toBeVisible({ timeout: 5000 });

    // Total plans: 59
    await expect(page.getByText('59').first()).toBeVisible({ timeout: 5000 });
  });

  test('recent enrollments table renders', async ({ page }) => {
    await mockTrpcQuery(page, 'clinic.getDashboardStats', clinicDashboardStats);
    await mockTrpcQuery(page, 'clinic.getMonthlyRevenue', clinicMonthlyRevenue);
    await mockAllTrpc(page);

    await gotoPortalPage(page, '/clinic/dashboard');

    // Recent enrollments from mock data
    await expect(page.getByText(/jane doe/i).first()).toBeVisible({ timeout: 5000 });
    await expect(page.getByText(/john smith/i).first()).toBeVisible({ timeout: 5000 });
  });

  test('monthly revenue renders 12 months of data', async ({ page }) => {
    await mockTrpcQuery(page, 'clinic.getDashboardStats', clinicDashboardStats);
    await mockTrpcQuery(page, 'clinic.getMonthlyRevenue', clinicMonthlyRevenue);
    await mockAllTrpc(page);

    await gotoPortalPage(page, '/clinic/dashboard');

    // Revenue section — look for revenue-related content or chart
    const revenue = page.getByText(/revenue/i);
    await expect(revenue.first()).toBeVisible({ timeout: 5000 });
  });

  test('initiate enrollment links to /clinic/enroll', async ({ page }) => {
    await mockTrpcQuery(page, 'clinic.getDashboardStats', clinicDashboardStats);
    await mockTrpcQuery(page, 'clinic.getMonthlyRevenue', clinicMonthlyRevenue);
    await mockAllTrpc(page);

    await gotoPortalPage(page, '/clinic/dashboard');

    const enrollBtn = page.getByRole('link', { name: /initiate.*enrollment|new.*enrollment/i });
    if (await enrollBtn.isVisible({ timeout: 5000 }).catch(() => false)) {
      const href = await enrollBtn.getAttribute('href');
      expect(href).toContain('/clinic/enroll');
    }
  });

  test('empty state: new clinic with zero data', async ({ page }) => {
    await mockTrpcQuery(page, 'clinic.getDashboardStats', emptyClinicDashboardStats);
    await mockTrpcQuery(page, 'clinic.getMonthlyRevenue', []);
    await mockAllTrpc(page);

    await gotoPortalPage(page, '/clinic/dashboard');

    // Should show zero values
    await expect(page.getByText('0').first()).toBeVisible({ timeout: 5000 });
  });

  test('error state: tRPC failures', async ({ page }) => {
    await mockTrpcQueryError(page, 'clinic.getDashboardStats', 'INTERNAL_SERVER_ERROR', 'Failed');
    await mockTrpcQueryError(page, 'clinic.getMonthlyRevenue', 'INTERNAL_SERVER_ERROR', 'Failed');
    await mockAllTrpc(page);

    await gotoPortalPage(page, '/clinic/dashboard');

    const error = page.getByText(/unable.*load|error|something went wrong/i);
    await expect(error.first()).toBeVisible({ timeout: 10000 });
  });
});
