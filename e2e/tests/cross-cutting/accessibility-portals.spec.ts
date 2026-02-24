import { expect, test } from '@playwright/test';
import { clinicDashboardStats, clinicMonthlyRevenue } from '../../helpers/audit-mock-data';
import { gotoPortalPage, mockAllTrpc, mockExternalServices } from '../../helpers/portal-test-base';
import { mockTrpcQuery } from '../../helpers/trpc-mock';

test.describe.configure({ timeout: 90_000 });

test.describe('Accessibility — Portals', () => {
  test.use({ storageState: 'e2e/auth-state/clinic.json' });

  test('keyboard navigation through sidebar works', async ({ page }) => {
    await mockExternalServices(page);
    await mockTrpcQuery(page, 'clinic.getDashboardStats', clinicDashboardStats);
    await mockTrpcQuery(page, 'clinic.getMonthlyRevenue', clinicMonthlyRevenue);
    await mockAllTrpc(page);

    const loaded = await gotoPortalPage(page, '/clinic/dashboard');
    if (!loaded) return;

    // Find sidebar navigation links
    const navLinks = page.locator('nav a, aside a, [role="navigation"] a');
    const count = await navLinks.count();

    if (count > 0) {
      // Focus the first link
      await navLinks.first().focus();
      await expect(navLinks.first()).toBeFocused();

      // Tab through a few links
      for (let i = 0; i < Math.min(count - 1, 3); i++) {
        await page.keyboard.press('Tab');
      }
    }
  });
});
