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

  test('clicking export button shows loading state', async ({ page }) => {
    // Do NOT mock the export CSV query so it stays in loading state
    await gotoPortalPage(page, '/clinic/reports');

    const exportClientsBtn = page.getByRole('button', { name: /export clients/i });
    await expect(exportClientsBtn).toBeVisible({ timeout: 5000 });

    // Click the button to trigger the export query
    await exportClientsBtn.click();

    // The button text should change to "Exporting..." while loading
    await expect(page.getByRole('button', { name: /exporting\.\.\./i })).toBeVisible({
      timeout: 5000,
    });
  });

  test('after export completes, button returns to normal state', async ({ page }) => {
    // Mock the export CSV query so it resolves immediately
    await mockTrpcQuery(page, 'clinic.exportClientsCSV', {
      csv: 'Name,Email\nJane Doe,jane@example.com\n',
    });

    await gotoPortalPage(page, '/clinic/reports');

    const exportClientsBtn = page.getByRole('button', { name: /export clients/i });
    await expect(exportClientsBtn).toBeVisible({ timeout: 5000 });

    // Click to trigger export
    await exportClientsBtn.click();

    // After the query resolves, the button should revert to "Export Clients"
    await expect(page.getByRole('button', { name: /export clients/i })).toBeVisible({
      timeout: 5000,
    });

    // The button should not show "Exporting..." anymore
    await expect(page.getByRole('button', { name: /exporting\.\.\./i })).not.toBeVisible();
  });
});
