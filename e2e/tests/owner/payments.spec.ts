import { expect, test } from '@playwright/test';

test.describe('Owner Payments Page', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/owner/payments');
  });

  test('loads payments page with heading', async ({ page }, testInfo) => {
    await expect(page.getByRole('heading', { name: /my payment plans/i })).toBeVisible();

    await testInfo.attach('payments-heading', {
      body: await page.screenshot(),
      contentType: 'image/png',
    });
  });

  test('shows page description about tracking payments', async ({ page }) => {
    await expect(
      page.getByText(/track your payment progress and upcoming installments/i),
    ).toBeVisible();
  });

  test('displays dashboard summary section', async ({ page }, testInfo) => {
    // The DashboardSummary component renders a 3-column grid with
    // "Next Payment", "Total Paid", and "Total Remaining" cards.
    // Even in loading/error state, the grid or a fallback card should appear.
    const summarySection = page.locator('.grid.md\\:grid-cols-3').first();
    const fallbackCard = page.getByText(/unable to load dashboard summary/i);

    // Wait for either the summary grid or the error fallback to appear
    await expect(summarySection.or(fallbackCard)).toBeVisible({ timeout: 10000 });

    await testInfo.attach('dashboard-summary', {
      body: await page.screenshot(),
      contentType: 'image/png',
    });
  });

  test('has navigation to settings in header', async ({ page }) => {
    const settingsLink = page.getByRole('link', { name: /settings/i });
    await expect(settingsLink).toBeVisible();
    await expect(settingsLink).toHaveAttribute('href', '/owner/settings');
  });

  test('shows plan list content after loading', async ({ page }) => {
    // After data loads, the PlanList component renders one of three states:
    // 1. Empty state: "No payment plans yet" heading
    // 2. Error state: "Unable to load your payment plans."
    // 3. Plans loaded: "Active Plans" or "Past Plans" headings
    const emptyState = page.getByRole('heading', { name: /no payment plans yet/i });
    const errorState = page.getByText(/unable to load your payment plans/i);
    const activePlans = page.getByRole('heading', { name: /active plans/i });
    const pastPlans = page.getByRole('heading', { name: /past plans/i });

    await expect(emptyState.or(errorState).or(activePlans).or(pastPlans)).toBeVisible({
      timeout: 15000,
    });
  });

  test('captures screenshot of full dashboard', async ({ page }, testInfo) => {
    // Wait for the page to stabilize after data loading
    await page.waitForLoadState('domcontentloaded');

    await testInfo.attach('full-payments-dashboard', {
      body: await page.screenshot({ fullPage: true }),
      contentType: 'image/png',
    });
  });
});
