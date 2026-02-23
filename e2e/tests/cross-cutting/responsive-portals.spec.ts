import { expect, test } from '@playwright/test';
import {
  adminPlatformStats,
  adminRecentAuditLog,
  adminRiskPoolHealth,
  clinicClients,
  clinicDashboardStats,
  clinicMonthlyRevenue,
  ownerDashboardSummary,
  ownerPaymentHistory,
  ownerPlans,
} from '../../helpers/audit-mock-data';
import { gotoPortalPage, mockAllTrpc, mockExternalServices } from '../../helpers/portal-test-base';
import { mockTrpcQuery } from '../../helpers/trpc-mock';

// This file runs under the "mobile" project (Pixel 5) for responsive testing
test.describe.configure({ timeout: 90_000 });

test.describe('Portal Mobile Responsive — Owner', () => {
  test.use({ storageState: 'e2e/auth-state/owner.json' });

  test('owner payments on mobile', async ({ page }, testInfo) => {
    await mockExternalServices(page);
    await mockTrpcQuery(page, 'owner.getDashboardSummary', ownerDashboardSummary);
    await mockTrpcQuery(page, 'owner.getPlans', ownerPlans);
    await mockTrpcQuery(page, 'owner.getPaymentHistory', ownerPaymentHistory);
    await mockAllTrpc(page);

    await gotoPortalPage(page, '/owner/payments');

    await expect(page.getByText(/my payment plan|payment/i).first()).toBeVisible({ timeout: 5000 });
    await expect(page.getByText(/next payment/i).first()).toBeVisible({ timeout: 5000 });

    await testInfo.attach('mobile-owner-payments', {
      body: await page.screenshot({ fullPage: true }),
      contentType: 'image/png',
    });
  });

  test('enrollment wizard on mobile', async ({ page }, testInfo) => {
    await mockExternalServices(page);
    const { clinicSearch } = await import('../../helpers/audit-mock-data');
    await mockTrpcQuery(page, 'clinic.search', clinicSearch);
    await mockAllTrpc(page);

    await gotoPortalPage(page, '/owner/enroll');

    await expect(page.getByText(/enroll|payment plan|step 1|find your vet/i).first()).toBeVisible({
      timeout: 5000,
    });

    const searchInput = page.locator('#clinic-search');
    if (await searchInput.isVisible({ timeout: 3000 }).catch(() => false)) {
      await searchInput.fill('Happy');
      await expect(page.getByText('Happy Paws Veterinary').first()).toBeVisible({ timeout: 5000 });
    }

    await testInfo.attach('mobile-enrollment-wizard', {
      body: await page.screenshot({ fullPage: true }),
      contentType: 'image/png',
    });
  });
});

test.describe('Portal Mobile Responsive — Clinic', () => {
  test.use({ storageState: 'e2e/auth-state/clinic.json' });

  test('clinic dashboard on mobile', async ({ page }, testInfo) => {
    await mockExternalServices(page);
    await mockTrpcQuery(page, 'clinic.getDashboardStats', clinicDashboardStats);
    await mockTrpcQuery(page, 'clinic.getMonthlyRevenue', clinicMonthlyRevenue);
    await mockAllTrpc(page);

    await gotoPortalPage(page, '/clinic/dashboard');

    await expect(page.getByText(/clinic dashboard/i).first()).toBeVisible({ timeout: 5000 });
    await expect(page.getByText(/active plan/i).first()).toBeVisible({ timeout: 5000 });

    await testInfo.attach('mobile-clinic-dashboard', {
      body: await page.screenshot({ fullPage: true }),
      contentType: 'image/png',
    });
  });

  test('clinic clients table on mobile', async ({ page }, testInfo) => {
    await mockExternalServices(page);
    await mockTrpcQuery(page, 'clinic.getClients', clinicClients);
    await mockAllTrpc(page);

    await gotoPortalPage(page, '/clinic/clients');

    const content = page.getByText(/jane doe/i).or(page.getByText(/client/i));
    await expect(content.first()).toBeVisible({ timeout: 5000 });

    const searchInput = page.getByPlaceholder(/search/i);
    if (await searchInput.isVisible({ timeout: 3000 }).catch(() => false)) {
      await searchInput.fill('Jane');
      await page.waitForTimeout(500);
    }

    await testInfo.attach('mobile-clinic-clients', {
      body: await page.screenshot({ fullPage: true }),
      contentType: 'image/png',
    });
  });
});

test.describe('Portal Mobile Responsive — Admin', () => {
  test.use({ storageState: 'e2e/auth-state/admin.json' });

  test('admin dashboard on mobile', async ({ page }, testInfo) => {
    await mockExternalServices(page);
    await mockTrpcQuery(page, 'admin.getPlatformStats', adminPlatformStats);
    await mockTrpcQuery(page, 'admin.riskPoolHealth', adminRiskPoolHealth);
    await mockTrpcQuery(page, 'admin.getRecentAuditLog', adminRecentAuditLog);
    await mockAllTrpc(page);

    await gotoPortalPage(page, '/admin/dashboard');

    await expect(page.getByText(/admin dashboard/i).first()).toBeVisible({ timeout: 5000 });

    await testInfo.attach('mobile-admin-dashboard', {
      body: await page.screenshot({ fullPage: true }),
      contentType: 'image/png',
    });
  });
});
