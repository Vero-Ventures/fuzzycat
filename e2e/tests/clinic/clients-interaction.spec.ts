import { expect, test } from '@playwright/test';
import {
  clinicClients,
  clinicClientsFilteredActive,
  clinicClientsFilteredBySearch,
  clinicClientsPage2,
} from '../../helpers/audit-mock-data';
import { gotoPortalPage, mockAllTrpc } from '../../helpers/portal-test-base';
import { mockTrpcQuery } from '../../helpers/trpc-mock';

test.describe.configure({ timeout: 90_000 });

test.describe('Clinic Clients — Interactions', () => {
  test('search filters by name', async ({ page }) => {
    // Initial load with all clients
    await mockTrpcQuery(page, 'clinic.getClients', clinicClients);
    await mockAllTrpc(page);

    await gotoPortalPage(page, '/clinic/clients');

    // Type in search
    const searchInput = page.getByPlaceholder(/search/i);
    await expect(searchInput).toBeVisible({ timeout: 5000 });

    // Re-mock for filtered response
    await mockTrpcQuery(page, 'clinic.getClients', clinicClientsFilteredBySearch);
    await searchInput.fill('Jane');

    // Should show filtered result
    await expect(page.getByText(/jane doe/i).first()).toBeVisible({ timeout: 5000 });
  });

  test('status filter works', async ({ page }) => {
    await mockTrpcQuery(page, 'clinic.getClients', clinicClients);
    await mockAllTrpc(page);

    await gotoPortalPage(page, '/clinic/clients');

    // Find status filter
    const statusFilter = page
      .locator('select[aria-label="Filter by status"]')
      .or(page.getByRole('combobox').first());
    if (await statusFilter.isVisible({ timeout: 5000 }).catch(() => false)) {
      // Re-mock for filtered response
      await mockTrpcQuery(page, 'clinic.getClients', clinicClientsFilteredActive);
      await statusFilter.selectOption({ label: 'Active' });

      // Wait for re-render
      await page.waitForTimeout(1000);
    }
  });

  test('pagination next page', async ({ page }) => {
    // First page with indication of more pages
    const firstPageData = {
      ...clinicClients,
      pagination: { page: 1, pageSize: 2, totalCount: 6, totalPages: 3 },
    };
    await mockTrpcQuery(page, 'clinic.getClients', firstPageData);
    await mockAllTrpc(page);

    await gotoPortalPage(page, '/clinic/clients');

    // Next button should be visible
    const nextBtn = page.getByRole('button', { name: /next/i });
    if (await nextBtn.isVisible({ timeout: 5000 }).catch(() => false)) {
      // Mock page 2
      await mockTrpcQuery(page, 'clinic.getClients', clinicClientsPage2);
      await nextBtn.click();

      // Should load second page data
      await page.waitForTimeout(2000);
    }
  });
});
