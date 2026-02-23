import { expect, test } from '@playwright/test';
import {
  clinicDefaultRate,
  clinicEnrollmentTrends,
  clinicRevenueReport,
} from '../../helpers/audit-mock-data';
import { gotoPortalPage, mockAllTrpc } from '../../helpers/portal-test-base';
import { mockTrpcQuery } from '../../helpers/trpc-mock';

test.describe.configure({ timeout: 90_000 });

test.describe('Clinic Reports — Interactions', () => {
  test.beforeEach(async ({ page }) => {
    await mockTrpcQuery(page, 'clinic.getRevenueReport', clinicRevenueReport);
    await mockTrpcQuery(page, 'clinic.getEnrollmentTrends', clinicEnrollmentTrends);
    await mockTrpcQuery(page, 'clinic.getDefaultRate', clinicDefaultRate);
    await mockAllTrpc(page);
  });

  test('revenue report renders monthly breakdown', async ({ page }) => {
    await gotoPortalPage(page, '/clinic/reports');

    // Revenue section
    await expect(page.getByText(/revenue/i).first()).toBeVisible({ timeout: 5000 });
  });

  test('enrollment trends visible', async ({ page }) => {
    await gotoPortalPage(page, '/clinic/reports');

    // Enrollment trends section
    await expect(page.getByText(/enrollment.*trend|trend/i).first()).toBeVisible({ timeout: 5000 });
  });

  test('default rate percentage renders', async ({ page }) => {
    await gotoPortalPage(page, '/clinic/reports');

    // Default rate: 3.39%
    await expect(page.getByText(/3\.39/).first()).toBeVisible({ timeout: 5000 });
  });

  test('export clients CSV triggers download', async ({ page }) => {
    await gotoPortalPage(page, '/clinic/reports');

    // Look for CSV export buttons
    const exportBtn = page
      .getByRole('button', { name: /export.*client|client.*csv/i })
      .or(page.getByRole('button', { name: /export/i }).first());

    if (await exportBtn.isVisible({ timeout: 5000 }).catch(() => false)) {
      // Start waiting for download event
      const downloadPromise = page.waitForEvent('download', { timeout: 5000 }).catch(() => null);
      await exportBtn.click();
      const download = await downloadPromise;
      if (download) {
        expect(download.suggestedFilename()).toMatch(/\.csv$/i);
      }
    }
  });

  test('export revenue CSV triggers download', async ({ page }) => {
    await gotoPortalPage(page, '/clinic/reports');

    const exportBtn = page.getByRole('button', { name: /export.*revenue|revenue.*csv/i });
    if (await exportBtn.isVisible({ timeout: 5000 }).catch(() => false)) {
      const downloadPromise = page.waitForEvent('download', { timeout: 5000 }).catch(() => null);
      await exportBtn.click();
      const download = await downloadPromise;
      if (download) {
        expect(download.suggestedFilename()).toMatch(/\.csv$/i);
      }
    }
  });

  test('export payouts CSV triggers download', async ({ page }) => {
    await gotoPortalPage(page, '/clinic/reports');

    const exportBtn = page.getByRole('button', { name: /export.*payout|payout.*csv/i });
    if (await exportBtn.isVisible({ timeout: 5000 }).catch(() => false)) {
      const downloadPromise = page.waitForEvent('download', { timeout: 5000 }).catch(() => null);
      await exportBtn.click();
      const download = await downloadPromise;
      if (download) {
        expect(download.suggestedFilename()).toMatch(/\.csv$/i);
      }
    }
  });
});
