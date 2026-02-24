import { test } from '@playwright/test';

test.describe('Error handling', () => {
  test('captures screenshot of 404 page', async ({ page }, testInfo) => {
    await page.goto('/nonexistent-page-xyz', {
      waitUntil: 'domcontentloaded',
      timeout: 30000,
    });

    const screenshot = await page.screenshot({ fullPage: true });
    await testInfo.attach('404-page', {
      body: screenshot,
      contentType: 'image/png',
    });
  });
});
