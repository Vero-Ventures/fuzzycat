import { expect, test } from '@playwright/test';

test.describe('Clinic Dashboard', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/clinic/dashboard');
  });

  test('has initiate enrollment button', async ({ page }) => {
    const enrollButton = page.getByRole('link', {
      name: /initiate enrollment/i,
    });
    await expect(enrollButton).toBeVisible();
    await expect(enrollButton).toHaveAttribute('href', /\/clinic\/enroll/);
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
