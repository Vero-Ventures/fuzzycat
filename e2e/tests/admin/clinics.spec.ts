import { test } from '@playwright/test';

test.describe('Admin Clinics', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/admin/clinics');
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
