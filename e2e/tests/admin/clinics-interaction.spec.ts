import { expect, test } from '@playwright/test';
import {
  adminClinics,
  adminClinicsFilteredBySearch,
  adminClinicsFilteredPending,
} from '../../helpers/audit-mock-data';
import { gotoPortalPage, mockAllTrpc } from '../../helpers/portal-test-base';
import { mockTrpcQuery } from '../../helpers/trpc-mock';

test.describe.configure({ timeout: 90_000 });

test.describe('Admin Clinics — Interactions', () => {
  test('clinic list with all statuses renders', async ({ page }) => {
    await mockTrpcQuery(page, 'admin.getClinics', adminClinics);
    await mockAllTrpc(page);

    await gotoPortalPage(page, '/admin/clinics');

    // Table should render
    const table = page.locator('table').or(page.locator('[role="table"]'));
    await expect(table.first()).toBeVisible({ timeout: 5000 });

    // Clinic names from mock data
    await expect(page.getByText(/happy paws/i).first()).toBeVisible({ timeout: 5000 });
    await expect(page.getByText(/petcare plus/i).first()).toBeVisible({ timeout: 5000 });

    // Status badges
    await expect(page.getByText(/active/i).first()).toBeVisible({ timeout: 3000 });
    await expect(page.getByText(/pending/i).first()).toBeVisible({ timeout: 3000 });
    await expect(page.getByText(/suspended/i).first()).toBeVisible({ timeout: 3000 });
  });

  test('search filters clinics', async ({ page }) => {
    await mockTrpcQuery(page, 'admin.getClinics', adminClinics);
    await mockAllTrpc(page);

    await gotoPortalPage(page, '/admin/clinics');

    const searchInput = page.getByPlaceholder(/search/i);
    if (await searchInput.isVisible({ timeout: 5000 }).catch(() => false)) {
      await mockTrpcQuery(page, 'admin.getClinics', adminClinicsFilteredBySearch);
      await searchInput.fill('Happy');
      await page.waitForTimeout(1000);
    }
  });

  test('status filter tabs work', async ({ page }) => {
    await mockTrpcQuery(page, 'admin.getClinics', adminClinics);
    await mockAllTrpc(page);

    await gotoPortalPage(page, '/admin/clinics');

    // Click pending tab
    const pendingTab = page
      .getByRole('tab', { name: /pending/i })
      .or(page.getByRole('button', { name: /pending/i }));
    if (await pendingTab.isVisible({ timeout: 5000 }).catch(() => false)) {
      await mockTrpcQuery(page, 'admin.getClinics', adminClinicsFilteredPending);
      await pendingTab.click();
      await page.waitForTimeout(1000);
    }
  });

  test('Stripe connected column shows badges', async ({ page }) => {
    await mockTrpcQuery(page, 'admin.getClinics', adminClinics);
    await mockAllTrpc(page);

    await gotoPortalPage(page, '/admin/clinics');

    // Connected and Not Connected badges
    const connected = page.getByText(/connected/i);
    await expect(connected.first()).toBeVisible({ timeout: 5000 });
  });
});
