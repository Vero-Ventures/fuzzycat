import { test } from '@playwright/test';

test.describe('Clinic Settings', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/clinic/settings');
  });

  test('captures screenshot', async ({ page }, testInfo) => {
    await page.waitForLoadState('domcontentloaded');

    await testInfo.attach('clinic-settings', {
      body: await page.screenshot({ fullPage: true }),
      contentType: 'image/png',
    });
  });
});
