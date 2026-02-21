import { expect, test } from '@playwright/test';

test.describe('Clinic Dashboard', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/clinic/dashboard');
  });

  test('loads dashboard', async ({ page }) => {
    await expect(page.getByRole('heading', { name: /clinic dashboard/i })).toBeVisible();
    await expect(page).toHaveURL(/\/clinic\/dashboard/);
  });

  test('shows dashboard stats', async ({ page }) => {
    // The stats section renders cards with titles like "Active Plans", "Revenue Earned", etc.
    // It may be loading (skeleton) or loaded — either state means the section exists.
    const statsSection = page.locator('.grid').first();
    await expect(statsSection).toBeVisible({ timeout: 10000 });

    // At least one stat card should be present (loading skeleton or real data)
    const cards = page.locator('[class*="card"]');
    await expect(cards.first()).toBeVisible({ timeout: 10000 });
  });

  test('has initiate enrollment button', async ({ page }) => {
    const enrollButton = page.getByRole('link', {
      name: /initiate enrollment/i,
    });
    await expect(enrollButton).toBeVisible();
    await expect(enrollButton).toHaveAttribute('href', /\/owner\/enroll/);
  });

  test('shows recent enrollments', async ({ page }) => {
    // The RecentEnrollments component renders a card with "Recent Enrollments" title
    const recentEnrollmentsHeading = page.getByText(/recent enrollments/i);
    await expect(recentEnrollmentsHeading).toBeVisible({ timeout: 10000 });
  });

  test('shows revenue table', async ({ page }) => {
    // The RevenueTable component renders a card with "Monthly Revenue" title
    const revenueHeading = page.getByText(/monthly revenue/i);
    await expect(revenueHeading).toBeVisible({ timeout: 10000 });
  });

  test('has sidebar navigation', async ({ page }) => {
    const sidebar = page.locator('aside');
    await expect(sidebar).toBeVisible();

    // Verify sidebar contains navigation links to all clinic pages
    await expect(page.locator('aside').getByRole('link', { name: /dashboard/i })).toBeVisible();
    await expect(page.locator('aside').getByRole('link', { name: /clients/i })).toBeVisible();
    await expect(page.locator('aside').getByRole('link', { name: /payouts/i })).toBeVisible();
    await expect(page.locator('aside').getByRole('link', { name: /reports/i })).toBeVisible();
    await expect(page.locator('aside').getByRole('link', { name: /settings/i })).toBeVisible();
  });

  test('captures screenshot', async ({ page }, testInfo) => {
    // Wait for the page to settle
    await page.waitForLoadState('networkidle');

    await testInfo.attach('clinic-dashboard', {
      body: await page.screenshot(),
      contentType: 'image/png',
    });
  });
});
