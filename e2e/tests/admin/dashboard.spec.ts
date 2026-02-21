import { expect, test } from '@playwright/test';

test.describe('Admin Dashboard', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/admin/dashboard');
  });

  test('loads dashboard', async ({ page }) => {
    await expect(page).toHaveURL(/\/admin\/dashboard/);
    await expect(page.getByRole('heading', { name: /dashboard/i })).toBeVisible();
  });

  test('shows platform stats', async ({ page }) => {
    // The dashboard should display KPI / platform statistics
    const statsSection = page.locator(
      '[data-testid="platform-stats"], [class*="stats"], [class*="kpi"]',
    );
    const statsHeading = page.getByText(/stats|metrics|overview|kpi|platform/i);

    // At least one stats indicator should be visible
    await expect(statsSection.or(statsHeading).first()).toBeVisible({
      timeout: 10000,
    });
  });

  test('shows recent activity', async ({ page }) => {
    // The dashboard should display recent activity or audit log entries
    const activitySection = page.getByText(/recent activity|audit|activity log|recent events/i);
    await expect(activitySection.first()).toBeVisible({ timeout: 10000 });
  });

  test('has sidebar navigation', async ({ page }) => {
    // AdminSidebar should have links to other admin pages
    const sidebar = page.locator('nav, [data-testid="admin-sidebar"], [class*="sidebar"]');
    await expect(sidebar.first()).toBeVisible();

    // Check for navigation links to other admin pages
    await expect(page.getByRole('link', { name: /clinics/i })).toBeVisible();
    await expect(page.getByRole('link', { name: /payments/i })).toBeVisible();
    await expect(page.getByRole('link', { name: /risk/i })).toBeVisible();
  });

  test('captures screenshot', async ({ page }, testInfo) => {
    // Wait for content to load
    await page.waitForLoadState('networkidle');

    const screenshot = await page.screenshot({ fullPage: true });
    await testInfo.attach('admin-dashboard', {
      body: screenshot,
      contentType: 'image/png',
    });
  });
});
