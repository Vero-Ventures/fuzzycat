import { expect, test } from '@playwright/test';
import {
  clinicDefaultRate,
  clinicEnrollmentTrends,
  clinicRevenueReport,
} from '../../helpers/audit-mock-data';
import { gotoPortalPage, mockAllTrpc } from '../../helpers/portal-test-base';
import { mockTrpcQuery } from '../../helpers/trpc-mock';

test.describe.configure({ timeout: 90_000 });

test.describe('Clinic Reports — Export', () => {
  test.beforeEach(async ({ page }) => {
    await mockTrpcQuery(page, 'clinic.getRevenueReport', clinicRevenueReport);
    await mockTrpcQuery(page, 'clinic.getEnrollmentTrends', clinicEnrollmentTrends);
    await mockTrpcQuery(page, 'clinic.getDefaultRate', clinicDefaultRate);
    await mockAllTrpc(page);
  });

  test('revenue report section shows data from mock', async ({ page }) => {
    await gotoPortalPage(page, '/clinic/reports');

    // Revenue Report card title
    await expect(page.getByText('Revenue Report').first()).toBeVisible({ timeout: 5000 });

    // Revenue table should render with months from mock data
    const table = page.locator('table').or(page.locator('[role="table"]'));
    await expect(table.first()).toBeVisible({ timeout: 5000 });

    // Month values from clinicRevenueReport mock
    await expect(page.getByText('2026-01').first()).toBeVisible();
    await expect(page.getByText('2026-02').first()).toBeVisible();

    // Enrollment counts from mock (5 and 3)
    await expect(page.getByRole('cell', { name: '5' }).first()).toBeVisible();
    await expect(page.getByRole('cell', { name: '3' }).first()).toBeVisible();
  });

  test('enrollment trends section shows trend data', async ({ page }) => {
    await gotoPortalPage(page, '/clinic/reports');

    // Enrollment Trends card title
    await expect(page.getByText('Enrollment Trends').first()).toBeVisible({ timeout: 5000 });

    // The trends table should have months from mock data
    // Check a few representative months from clinicEnrollmentTrends
    await expect(page.getByText('2025-03').first()).toBeVisible();
    await expect(page.getByText('2025-12').first()).toBeVisible();
  });

  test('default rate card shows "3.39%"', async ({ page }) => {
    await gotoPortalPage(page, '/clinic/reports');

    // DefaultRateCard renders the rate as "{defaultRate}%"
    await expect(page.getByText('3.39%').first()).toBeVisible({ timeout: 5000 });

    // Also shows "2 defaulted of 59 total plans"
    await expect(page.getByText(/2 defaulted of 59 total plans/i).first()).toBeVisible();
  });

  test('export buttons are visible', async ({ page }) => {
    await gotoPortalPage(page, '/clinic/reports');

    // Three export buttons from ExportButtons component
    await expect(page.getByRole('button', { name: /export clients/i })).toBeVisible({
      timeout: 5000,
    });
    await expect(page.getByRole('button', { name: /export revenue/i })).toBeVisible();
    await expect(page.getByRole('button', { name: /export payouts/i })).toBeVisible();
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
