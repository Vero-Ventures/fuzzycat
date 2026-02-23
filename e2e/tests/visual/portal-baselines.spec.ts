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
} from '../../helpers/audit-mock-data';
import { gotoPortalPage, mockAllTrpc, mockExternalServices } from '../../helpers/portal-test-base';
import { mockTrpcQuery } from '../../helpers/trpc-mock';

test.describe.configure({ timeout: 90_000 });

test.describe('Visual Baselines — Owner Portal', () => {
  test.use({ storageState: 'e2e/auth-state/owner.json' });

  test('owner payments baseline', async ({ page }) => {
    await mockExternalServices(page);
    await mockTrpcQuery(page, 'owner.getDashboardSummary', ownerDashboardSummary);
    await mockTrpcQuery(page, 'owner.getPlans', ownerPlans);
    await mockTrpcQuery(page, 'owner.getPaymentHistory', ownerPaymentHistory);
    await mockAllTrpc(page);

    await gotoPortalPage(page, '/owner/payments');

    await expect(page).toHaveScreenshot('owner-payments.png', {
      fullPage: true,
      maxDiffPixelRatio: 0.02,
    });
  });

  test('owner settings baseline', async ({ page }) => {
    await mockExternalServices(page);
    await mockTrpcQuery(page, 'owner.getProfile', ownerProfile);
    await mockTrpcQuery(page, 'owner.getPlans', ownerPlans);
    await mockAllTrpc(page);

    await gotoPortalPage(page, '/owner/settings');

    await expect(page).toHaveScreenshot('owner-settings.png', {
      fullPage: true,
      maxDiffPixelRatio: 0.02,
    });
  });

  test('owner enrollment baseline', async ({ page }) => {
    await mockExternalServices(page);
    await mockTrpcQuery(page, 'clinic.search', clinicSearch);
    await mockAllTrpc(page);

    await gotoPortalPage(page, '/owner/enroll');

    await expect(page).toHaveScreenshot('owner-enroll.png', {
      fullPage: true,
      maxDiffPixelRatio: 0.02,
    });
  });
});

test.describe('Visual Baselines — Clinic Portal', () => {
  test.use({ storageState: 'e2e/auth-state/clinic.json' });

  test('clinic dashboard baseline', async ({ page }) => {
    await mockExternalServices(page);
    await mockTrpcQuery(page, 'clinic.getDashboardStats', clinicDashboardStats);
    await mockTrpcQuery(page, 'clinic.getMonthlyRevenue', clinicMonthlyRevenue);
    await mockAllTrpc(page);

    await gotoPortalPage(page, '/clinic/dashboard');

    await expect(page).toHaveScreenshot('clinic-dashboard.png', {
      fullPage: true,
      maxDiffPixelRatio: 0.02,
    });
  });

  test('clinic clients baseline', async ({ page }) => {
    await mockExternalServices(page);
    await mockTrpcQuery(page, 'clinic.getClients', clinicClients);
    await mockAllTrpc(page);

    await gotoPortalPage(page, '/clinic/clients');

    await expect(page).toHaveScreenshot('clinic-clients.png', {
      fullPage: true,
      maxDiffPixelRatio: 0.02,
    });
  });

  test('clinic payouts baseline', async ({ page }) => {
    await mockExternalServices(page);
    await mockTrpcQuery(page, 'payout.earnings', payoutEarnings);
    await mockTrpcQuery(page, 'payout.history', payoutHistory);
    await mockAllTrpc(page);

    await gotoPortalPage(page, '/clinic/payouts');

    await expect(page).toHaveScreenshot('clinic-payouts.png', {
      fullPage: true,
      maxDiffPixelRatio: 0.02,
    });
  });

  test('clinic reports baseline', async ({ page }) => {
    await mockExternalServices(page);
    await mockTrpcQuery(page, 'clinic.getRevenueReport', clinicRevenueReport);
    await mockTrpcQuery(page, 'clinic.getEnrollmentTrends', clinicEnrollmentTrends);
    await mockTrpcQuery(page, 'clinic.getDefaultRate', clinicDefaultRate);
    await mockAllTrpc(page);

    await gotoPortalPage(page, '/clinic/reports');

    await expect(page).toHaveScreenshot('clinic-reports.png', {
      fullPage: true,
      maxDiffPixelRatio: 0.02,
    });
  });

  test('clinic settings baseline', async ({ page }) => {
    await mockExternalServices(page);
    await mockTrpcQuery(page, 'clinic.getProfile', clinicProfile);
    await mockAllTrpc(page);

    await gotoPortalPage(page, '/clinic/settings');

    await expect(page).toHaveScreenshot('clinic-settings.png', {
      fullPage: true,
      maxDiffPixelRatio: 0.02,
    });
  });

  test('clinic onboarding baseline', async ({ page }) => {
    await mockExternalServices(page);
    await mockTrpcQuery(page, 'clinic.getOnboardingStatus', clinicOnboardingStatus);
    await mockAllTrpc(page);

    await gotoPortalPage(page, '/clinic/onboarding');

    await expect(page).toHaveScreenshot('clinic-onboarding.png', {
      fullPage: true,
      maxDiffPixelRatio: 0.02,
    });
  });
});

test.describe('Visual Baselines — Admin Portal', () => {
  test.use({ storageState: 'e2e/auth-state/admin.json' });

  test('admin dashboard baseline', async ({ page }) => {
    await mockExternalServices(page);
    await mockTrpcQuery(page, 'admin.getPlatformStats', adminPlatformStats);
    await mockTrpcQuery(page, 'admin.riskPoolHealth', adminRiskPoolHealth);
    await mockTrpcQuery(page, 'admin.getRecentAuditLog', adminRecentAuditLog);
    await mockAllTrpc(page);

    await gotoPortalPage(page, '/admin/dashboard');

    await expect(page).toHaveScreenshot('admin-dashboard.png', {
      fullPage: true,
      maxDiffPixelRatio: 0.02,
    });
  });

  test('admin clinics baseline', async ({ page }) => {
    await mockExternalServices(page);
    await mockTrpcQuery(page, 'admin.getClinics', adminClinics);
    await mockAllTrpc(page);

    await gotoPortalPage(page, '/admin/clinics');

    await expect(page).toHaveScreenshot('admin-clinics.png', {
      fullPage: true,
      maxDiffPixelRatio: 0.02,
    });
  });

  test('admin payments baseline', async ({ page }) => {
    await mockExternalServices(page);
    await mockTrpcQuery(page, 'admin.getPayments', adminPayments);
    await mockAllTrpc(page);

    await gotoPortalPage(page, '/admin/payments');

    await expect(page).toHaveScreenshot('admin-payments.png', {
      fullPage: true,
      maxDiffPixelRatio: 0.02,
    });
  });

  test('admin risk baseline', async ({ page }) => {
    await mockExternalServices(page);
    await mockTrpcQuery(page, 'admin.riskPoolBalance', adminRiskPoolBalance);
    await mockTrpcQuery(page, 'admin.riskPoolHealth', adminRiskPoolHealth);
    await mockTrpcQuery(page, 'admin.getRiskPoolDetails', adminRiskPoolDetails);
    await mockTrpcQuery(page, 'admin.getSoftCollections', adminSoftCollections);
    await mockTrpcQuery(page, 'admin.getDefaultedPlans', adminDefaultedPlans);
    await mockTrpcQuery(page, 'admin.getSoftCollectionStats', adminSoftCollectionStats);
    await mockAllTrpc(page);

    await gotoPortalPage(page, '/admin/risk');

    await expect(page).toHaveScreenshot('admin-risk.png', {
      fullPage: true,
      maxDiffPixelRatio: 0.02,
    });
  });
});
