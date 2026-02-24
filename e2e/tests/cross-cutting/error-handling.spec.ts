import { expect, test } from '@playwright/test';

test.describe('Error handling', () => {
  test('404 page for unknown route', async ({ page }) => {
    const response = await page.goto('/nonexistent-page-xyz', {
      waitUntil: 'domcontentloaded',
      timeout: 30000,
    });

    // Either the server returns a 404 status or the page shows "not found" content
    const is404Status = response?.status() === 404;
    const hasNotFoundText = await page
      .getByText(/not found|404|page.*doesn.*exist|page.*not.*exist/i)
      .isVisible()
      .catch(() => false);

    expect(is404Status || hasNotFoundText).toBe(true);
  });

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
