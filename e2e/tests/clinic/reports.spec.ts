import { expect, test } from '@playwright/test';

test.describe('Clinic Reports', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/clinic/reports');
  });

  test('loads reports page', async ({ page }) => {
    await expect(page.getByRole('heading', { name: /reports/i })).toBeVisible();
    await expect(page).toHaveURL(/\/clinic\/reports/);
  });

  test('shows report content', async ({ page }) => {
    // The reports page contains: RevenueReport, EnrollmentTrends, ExportButtons
    const revenueReport = page.getByRole('heading', { name: /revenue report/i });
    await expect(revenueReport).toBeVisible({ timeout: 10000 });

    const enrollmentTrends = page.getByText(/enrollment trends/i);
    await expect(enrollmentTrends).toBeVisible({ timeout: 10000 });

    const exportData = page.getByText(/export data/i);
    await expect(exportData).toBeVisible({ timeout: 10000 });
  });

  test('captures screenshot', async ({ page }, testInfo) => {
    await page.waitForLoadState('networkidle');

    await testInfo.attach('clinic-reports', {
      body: await page.screenshot({ fullPage: true }),
      contentType: 'image/png',
    });
  });
});
