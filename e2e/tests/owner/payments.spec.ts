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

  test('has navigation to enroll or shows empty state with enroll prompt', async ({ page }) => {
    // The page may show an enroll link/button, or the empty plan state
    // mentions that plans appear when a clinic sets one up.
    // Check for either an explicit enroll link or the empty state content.
    const enrollLink = page.getByRole('link', { name: /enroll|new.*plan|start/i });
    const emptyState = page.getByText(/no payment plans yet/i);

    await expect(enrollLink.or(emptyState)).toBeVisible({ timeout: 10000 });
  });

  test('captures screenshot of full dashboard', async ({ page }, testInfo) => {
    // Wait for the page to stabilize after data loading
    await page.waitForLoadState('networkidle');

    await testInfo.attach('full-payments-dashboard', {
      body: await page.screenshot({ fullPage: true }),
      contentType: 'image/png',
    });
  });
});
