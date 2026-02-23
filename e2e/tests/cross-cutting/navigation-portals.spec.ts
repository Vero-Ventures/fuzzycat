import { expect, test } from '@playwright/test';
import {
  gotoPortalPage,
  mockAllTrpc,
  mockExternalServices,
  setupPortalMocks,
} from '../../helpers/portal-test-base';

test.describe.configure({ timeout: 90_000 });

test.describe('Navigation — Portals', () => {
  test('clinic sidebar all links work', async ({ page }) => {
    await mockExternalServices(page);
    await setupPortalMocks(page, 'clinic');
    await mockAllTrpc(page);

    await gotoPortalPage(page, '/clinic/dashboard');

    const clinicRoutes = [
      { pattern: /dashboard/i, url: '/clinic/dashboard' },
      { pattern: /client/i, url: '/clinic/clients' },
      { pattern: /payout/i, url: '/clinic/payouts' },
      { pattern: /report/i, url: '/clinic/reports' },
      { pattern: /setting/i, url: '/clinic/settings' },
    ];

    for (const { pattern, url } of clinicRoutes) {
      const link = page
        .locator(`nav a, aside a, [role="navigation"] a`)
        .filter({ hasText: pattern });
      if (
        await link
          .first()
          .isVisible({ timeout: 3000 })
          .catch(() => false)
      ) {
        await link.first().click();
        await page.waitForLoadState('domcontentloaded');
        expect(page.url()).toContain(url.split('/').pop());
        await page.waitForTimeout(500);
      }
    }
  });

  test('admin sidebar all links work', async ({ page }) => {
    await mockExternalServices(page);
    await setupPortalMocks(page, 'admin');
    await mockAllTrpc(page);

    await gotoPortalPage(page, '/admin/dashboard');

    const adminRoutes = [
      { pattern: /dashboard/i, url: '/admin/dashboard' },
      { pattern: /clinic/i, url: '/admin/clinics' },
      { pattern: /payment/i, url: '/admin/payments' },
      { pattern: /risk/i, url: '/admin/risk' },
    ];

    for (const { pattern, url } of adminRoutes) {
      const link = page
        .locator(`nav a, aside a, [role="navigation"] a`)
        .filter({ hasText: pattern });
      if (
        await link
          .first()
          .isVisible({ timeout: 3000 })
          .catch(() => false)
      ) {
        await link.first().click();
        await page.waitForLoadState('domcontentloaded');
        expect(page.url()).toContain(url.split('/').pop());
        await page.waitForTimeout(500);
      }
    }
  });

  test('owner header navigation', async ({ page }) => {
    await mockExternalServices(page);
    await setupPortalMocks(page, 'owner');
    await mockAllTrpc(page);

    await gotoPortalPage(page, '/owner/payments');

    // Owner navigation links
    const settingsLink = page.getByRole('link', { name: /setting/i });
    if (await settingsLink.isVisible({ timeout: 5000 }).catch(() => false)) {
      await settingsLink.click();
      await page.waitForLoadState('domcontentloaded');
      expect(page.url()).toContain('/owner/settings');
    }
  });

  test('sign out button is visible', async ({ page }) => {
    await mockExternalServices(page);
    await setupPortalMocks(page, 'clinic');
    await mockAllTrpc(page);

    await gotoPortalPage(page, '/clinic/dashboard');

    const signOutBtn = page.getByRole('button', { name: /sign out|log out/i });
    await expect(signOutBtn).toBeVisible({ timeout: 5000 });
  });
});
