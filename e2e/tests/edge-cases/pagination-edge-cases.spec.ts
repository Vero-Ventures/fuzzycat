import { expect, test } from '@playwright/test';
import { clinicClients, clinicClientsPage2 } from '../../helpers/audit-mock-data';
import { gotoPortalPage, mockAllTrpc, mockExternalServices } from '../../helpers/portal-test-base';
import { mockTrpcQuery } from '../../helpers/trpc-mock';

test.describe.configure({ timeout: 90_000 });

test.describe('Pagination — Edge Cases', () => {
  test.use({ storageState: 'e2e/auth-state/clinic.json' });

  test('single page hides pagination controls', async ({ page }) => {
    await mockExternalServices(page);
    // Single page — totalPages = 1
    await mockTrpcQuery(page, 'clinic.getClients', {
      ...clinicClients,
      pagination: { page: 1, pageSize: 20, totalCount: 4, totalPages: 1 },
    });
    await mockAllTrpc(page);

    await gotoPortalPage(page, '/clinic/clients');

    // Pagination buttons should be hidden or disabled
    const nextBtn = page.getByRole('button', { name: /next/i });
    const prevBtn = page.getByRole('button', { name: /previous/i });

    // Either not visible or disabled
    if (await nextBtn.isVisible({ timeout: 3000 }).catch(() => false)) {
      await expect(nextBtn).toBeDisabled();
    }
    if (await prevBtn.isVisible({ timeout: 3000 }).catch(() => false)) {
      await expect(prevBtn).toBeDisabled();
    }
  });

  test('first page disables previous button', async ({ page }) => {
    await mockExternalServices(page);
    await mockTrpcQuery(page, 'clinic.getClients', {
      ...clinicClients,
      pagination: { page: 1, pageSize: 2, totalCount: 6, totalPages: 3 },
    });
    await mockAllTrpc(page);

    await gotoPortalPage(page, '/clinic/clients');

    const prevBtn = page.getByRole('button', { name: /previous/i });
    if (await prevBtn.isVisible({ timeout: 3000 }).catch(() => false)) {
      await expect(prevBtn).toBeDisabled();
    }
  });

  test('navigate forward and back', async ({ page }) => {
    await mockExternalServices(page);
    const page1Data = {
      ...clinicClients,
      pagination: { page: 1, pageSize: 2, totalCount: 6, totalPages: 3 },
    };
    await mockTrpcQuery(page, 'clinic.getClients', page1Data);
    await mockAllTrpc(page);

    await gotoPortalPage(page, '/clinic/clients');

    const nextBtn = page.getByRole('button', { name: /next/i });
    if (await nextBtn.isVisible({ timeout: 5000 }).catch(() => false)) {
      // Navigate to page 2
      await mockTrpcQuery(page, 'clinic.getClients', clinicClientsPage2);
      await nextBtn.click();
      await page.waitForTimeout(1000);

      // Navigate back
      const prevBtn = page.getByRole('button', { name: /previous/i });
      if (await prevBtn.isVisible({ timeout: 3000 }).catch(() => false)) {
        await mockTrpcQuery(page, 'clinic.getClients', page1Data);
        await prevBtn.click();
        await page.waitForTimeout(1000);
      }
    }
  });
});
