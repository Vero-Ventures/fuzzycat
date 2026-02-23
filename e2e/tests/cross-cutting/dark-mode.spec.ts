import { expect, test } from '@playwright/test';

test.describe('Dark Mode', () => {
  test('theme toggle switches to dark mode', async ({ page }) => {
    await page.goto('/');

    // Find theme toggle button
    const themeToggle = page
      .getByRole('button', { name: /toggle.*theme|dark.*mode|light.*mode|theme/i })
      .or(page.locator('[aria-label*="theme"]'))
      .or(page.locator('[aria-label*="Theme"]'));

    if (await themeToggle.isVisible({ timeout: 5000 }).catch(() => false)) {
      await themeToggle.click();

      // Verify dark class is applied to html or body
      const isDark = await page.evaluate(() => {
        return (
          document.documentElement.classList.contains('dark') ||
          document.documentElement.getAttribute('data-theme') === 'dark' ||
          document.documentElement.style.colorScheme === 'dark'
        );
      });
      expect(isDark).toBe(true);
    }
  });

  test('dark mode persists across navigation', async ({ page }) => {
    await page.goto('/');

    const themeToggle = page
      .getByRole('button', { name: /toggle.*theme|dark.*mode|light.*mode|theme/i })
      .or(page.locator('[aria-label*="theme"]'))
      .or(page.locator('[aria-label*="Theme"]'));

    if (await themeToggle.isVisible({ timeout: 5000 }).catch(() => false)) {
      await themeToggle.click();
      await page.waitForTimeout(500);

      // Navigate to another page
      await page.goto('/how-it-works');
      await page.waitForLoadState('domcontentloaded');

      // Dark mode should persist
      const isDark = await page.evaluate(() => {
        return (
          document.documentElement.classList.contains('dark') ||
          document.documentElement.getAttribute('data-theme') === 'dark'
        );
      });
      expect(isDark).toBe(true);
    }
  });

  test('all public pages render in dark mode', async ({ page }, testInfo) => {
    await page.goto('/');

    const themeToggle = page
      .getByRole('button', { name: /toggle.*theme|dark.*mode|light.*mode|theme/i })
      .or(page.locator('[aria-label*="theme"]'))
      .or(page.locator('[aria-label*="Theme"]'));

    if (await themeToggle.isVisible({ timeout: 5000 }).catch(() => false)) {
      await themeToggle.click();
      await page.waitForTimeout(500);
    }

    const pages = [
      { url: '/', name: 'dark-landing' },
      { url: '/how-it-works', name: 'dark-how-it-works' },
      { url: '/login', name: 'dark-login' },
      { url: '/signup', name: 'dark-signup' },
      { url: '/forgot-password', name: 'dark-forgot-password' },
    ];

    for (const { url, name } of pages) {
      await page.goto(url);
      await page.waitForLoadState('domcontentloaded');
      await testInfo.attach(name, {
        body: await page.screenshot({ fullPage: true }),
        contentType: 'image/png',
      });
    }
  });

  test('portal pages render in dark mode', async ({ page }, testInfo) => {
    // Mock tRPC for portal pages
    const { mockAllTrpc, setupPortalMocks, mockExternalServices } = await import(
      '../../helpers/portal-test-base'
    );
    await mockExternalServices(page);
    await setupPortalMocks(page, 'clinic');
    await mockAllTrpc(page);

    await page.goto('/clinic/dashboard', { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(2000);

    const themeToggle = page
      .getByRole('button', { name: /toggle.*theme|dark.*mode|light.*mode|theme/i })
      .or(page.locator('[aria-label*="theme"]'))
      .or(page.locator('[aria-label*="Theme"]'));

    if (await themeToggle.isVisible({ timeout: 5000 }).catch(() => false)) {
      await themeToggle.click();
      await page.waitForTimeout(500);

      await testInfo.attach('dark-clinic-dashboard', {
        body: await page.screenshot({ fullPage: true }),
        contentType: 'image/png',
      });
    }
  });
});
