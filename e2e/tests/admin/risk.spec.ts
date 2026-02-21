import { expect, test } from '@playwright/test';

test.describe('Admin Risk', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/admin/risk');
  });

  test('loads risk page', async ({ page }) => {
    await expect(page).toHaveURL(/\/admin\/risk/);
    await expect(page.getByRole('heading', { name: /risk/i })).toBeVisible();
  });

  test('shows risk pool dashboard', async ({ page }) => {
    // The page should display risk pool / fund health information
    const riskPoolSection = page.getByText(
      /risk pool|fund health|pool balance|fund balance|guarantee fund/i,
    );
    await expect(riskPoolSection.first()).toBeVisible({ timeout: 10000 });
  });

  test('shows soft collections list', async ({ page }) => {
    // The page should display failed payments / soft collections section
    const collectionsSection = page.getByText(
      /soft collection|failed payment|collection|retry|overdue/i,
    );
    await expect(collectionsSection.first()).toBeVisible({ timeout: 10000 });
  });

  test('shows defaulted plans', async ({ page }) => {
    // The page should display defaulted plans section
    const defaultedSection = page.getByText(/defaulted.*plan|plan.*default|default/i);
    await expect(defaultedSection.first()).toBeVisible({ timeout: 10000 });
  });

  test('captures screenshot', async ({ page }, testInfo) => {
    await page.waitForLoadState('networkidle');

    const screenshot = await page.screenshot({ fullPage: true });
    await testInfo.attach('admin-risk', {
      body: screenshot,
      contentType: 'image/png',
    });
  });
});
