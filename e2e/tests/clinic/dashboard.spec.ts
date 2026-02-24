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
    const cards = page.locator('.rounded-xl.border');
    await expect(cards.first()).toBeVisible({ timeout: 10000 });
  });

  test('has initiate enrollment button', async ({ page }) => {
    const enrollButton = page.getByRole('link', {
      name: /initiate enrollment/i,
    });
    await expect(enrollButton).toBeVisible();
    await expect(enrollButton).toHaveAttribute('href', /\/clinic\/enroll/);
  });

  test('shows recent enrollments section', async ({ page }) => {
    // The RecentEnrollments component shows one of:
    //   - "Recent Enrollments" heading (data loaded)
    //   - "No enrollments yet" (empty state)
    //   - "Unable to load recent enrollments" (error state)
    // Any of these means the component rendered past its loading skeleton.
    const loaded = page.getByText(/recent enrollments/i);
    const empty = page.getByText(/no enrollments yet/i);
    const error = page.getByText(/unable to load recent enrollments/i);
    await expect(loaded.or(empty).or(error).first()).toBeVisible({ timeout: 15000 });
  });

  test('shows revenue section', async ({ page }) => {
    // The RevenueTable component shows one of:
    //   - "Monthly Revenue" heading (data loaded)
    //   - "No payout data yet" (empty state)
    //   - "Unable to load revenue data" (error state)
    const loaded = page.getByText(/monthly revenue/i);
    const empty = page.getByText(/no payout data yet/i);
    const error = page.getByText(/unable to load revenue data/i);
    await expect(loaded.or(empty).or(error).first()).toBeVisible({ timeout: 15000 });
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
    await page.waitForLoadState('domcontentloaded');

    await testInfo.attach('clinic-dashboard', {
      body: await page.screenshot(),
      contentType: 'image/png',
    });
  });
});
