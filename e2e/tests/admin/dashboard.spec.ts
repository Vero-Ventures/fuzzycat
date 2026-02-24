import { expect, test } from '@playwright/test';

test.describe('Admin Dashboard', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/admin/dashboard');
  });

  test('has sidebar navigation', async ({ page }) => {
    // AdminSidebar should have links to other admin pages
    const sidebar = page.locator('nav, [data-testid="admin-sidebar"], [class*="sidebar"]');
    await expect(sidebar.first()).toBeVisible();

    // Check for navigation links to other admin pages
    await expect(page.getByRole('link', { name: /clinics/i })).toBeVisible();
    await expect(page.getByRole('link', { name: /payments/i })).toBeVisible();
    await expect(page.getByRole('link', { name: /platform reserve/i })).toBeVisible();
  });

  test('captures screenshot', async ({ page }, testInfo) => {
    // Wait for content to load
    await page.waitForLoadState('domcontentloaded');

    const screenshot = await page.screenshot({ fullPage: true });
    await testInfo.attach('admin-dashboard', {
      body: screenshot,
      contentType: 'image/png',
    });
  });
});
