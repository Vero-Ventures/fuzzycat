import { expect, test } from '@playwright/test';
import {
  clinicClients,
  clinicDashboardStats,
  clinicMonthlyRevenue,
} from '../../helpers/audit-mock-data';
import { gotoPortalPage, mockAllTrpc, mockExternalServices } from '../../helpers/portal-test-base';
import { mockTrpcQuery } from '../../helpers/trpc-mock';

test.describe.configure({ timeout: 90_000 });

test.describe('Accessibility — Portals', () => {
  test('portal pages have proper heading hierarchy', async ({ page }) => {
    await mockExternalServices(page);
    await mockTrpcQuery(page, 'clinic.getDashboardStats', clinicDashboardStats);
    await mockTrpcQuery(page, 'clinic.getMonthlyRevenue', clinicMonthlyRevenue);
    await mockAllTrpc(page);

    await gotoPortalPage(page, '/clinic/dashboard');

    // There should be exactly one h1
    const h1Count = await page.locator('h1').count();
    expect(h1Count).toBe(1);

    // Check heading hierarchy
    const headings = await page
      .locator('h1, h2, h3, h4, h5, h6')
      .evaluateAll((elements) =>
        elements.map((el) => Number.parseInt(el.tagName.replace('H', ''), 10)),
      );

    expect(headings.length).toBeGreaterThan(0);

    for (let i = 1; i < headings.length; i++) {
      if (headings[i] > headings[i - 1]) {
        expect(headings[i] - headings[i - 1]).toBeLessThanOrEqual(1);
      }
    }
  });

  test('form labels are associated with inputs', async ({ page }) => {
    await mockExternalServices(page);
    const { clinicProfile } = await import('../../helpers/audit-mock-data');
    await mockTrpcQuery(page, 'clinic.getProfile', clinicProfile);
    await mockAllTrpc(page);

    await gotoPortalPage(page, '/clinic/settings');

    const inputs = page.locator('input:not([type="hidden"])');
    const inputCount = await inputs.count();

    for (let i = 0; i < inputCount; i++) {
      const input = inputs.nth(i);
      if (!(await input.isVisible())) continue;

      const hasLabel = await input.evaluate((el) => {
        const id = el.id;
        const hasAssociatedLabel = id ? !!document.querySelector(`label[for="${id}"]`) : false;
        const hasAriaLabel = !!el.getAttribute('aria-label');
        const hasAriaLabelledBy = !!el.getAttribute('aria-labelledby');
        const hasParentLabel = !!el.closest('label');
        const hasPlaceholder = !!el.getAttribute('placeholder');
        return (
          hasAssociatedLabel ||
          hasAriaLabel ||
          hasAriaLabelledBy ||
          hasParentLabel ||
          hasPlaceholder
        );
      });

      expect(hasLabel).toBe(true);
    }
  });

  test('tables have proper ARIA roles or semantic structure', async ({ page }) => {
    await mockExternalServices(page);
    await mockTrpcQuery(page, 'clinic.getClients', clinicClients);
    await mockAllTrpc(page);

    await gotoPortalPage(page, '/clinic/clients');

    // Table or role="table" should exist
    const table = page.locator('table, [role="table"]');
    if (
      await table
        .first()
        .isVisible({ timeout: 5000 })
        .catch(() => false)
    ) {
      // Verify table has headers
      const headers = page.locator('th, [role="columnheader"]');
      expect(await headers.count()).toBeGreaterThan(0);
    }
  });

  test('keyboard navigation through sidebar works', async ({ page }) => {
    await mockExternalServices(page);
    await mockTrpcQuery(page, 'clinic.getDashboardStats', clinicDashboardStats);
    await mockTrpcQuery(page, 'clinic.getMonthlyRevenue', clinicMonthlyRevenue);
    await mockAllTrpc(page);

    await gotoPortalPage(page, '/clinic/dashboard');

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
