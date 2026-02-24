import { expect, test } from '@playwright/test';

test.describe('Admin Clinics', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/admin/clinics');
  });

  test('loads clinics page', async ({ page }) => {
    await expect(page).toHaveURL(/\/admin\/clinics/);
    await expect(page.getByRole('heading', { name: /clinics/i })).toBeVisible();
  });

  test('shows clinic list', async ({ page }) => {
    // The page should display a list or table of clinics
    const clinicList = page.locator(
      'table, [data-testid="clinic-list"], [class*="clinic-list"], ul, [role="table"]',
    );
    await expect(clinicList.first()).toBeVisible({ timeout: 10000 });
  });

  test('shows page description', async ({ page }) => {
    // The page should have descriptive text about managing clinics
    const description = page.getByText(
      /manage.*clinic|clinic.*manage|view.*clinic|clinic.*overview/i,
    );
    await expect(description.first()).toBeVisible({ timeout: 10000 });
  });

  test('captures screenshot', async ({ page }, testInfo) => {
    await page.waitForLoadState('domcontentloaded');

    const screenshot = await page.screenshot({ fullPage: true });
    await testInfo.attach('admin-clinics', {
      body: screenshot,
      contentType: 'image/png',
    });
  });
});
