import { expect, test } from '@playwright/test';

test.describe('Visual Baselines — Public Pages', () => {
  const publicPages = [
    { url: '/', name: 'landing' },
    { url: '/how-it-works', name: 'how-it-works' },
    { url: '/login', name: 'login' },
    { url: '/signup', name: 'signup' },
    { url: '/forgot-password', name: 'forgot-password' },
    { url: '/reset-password', name: 'reset-password' },
  ];

  for (const { url, name } of publicPages) {
    test(`${name} page visual baseline`, async ({ page }) => {
      await page.goto(url);
      await page.waitForLoadState('domcontentloaded');
      await page.waitForTimeout(1000); // Wait for animations to settle

      await expect(page).toHaveScreenshot(`public-${name}.png`, {
        fullPage: true,
        maxDiffPixelRatio: 0.02,
      });
    });
  }
});
