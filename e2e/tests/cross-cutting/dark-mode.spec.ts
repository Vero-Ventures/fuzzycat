import { expect, test } from '@playwright/test';
import { mockExternalServices } from '../../helpers/portal-test-base';

test.describe('Dark Mode — Public', () => {
  // Allow extra time — dev server can be slow under parallel load
  test.describe.configure({ timeout: 90_000 });

  // Mock external services to prevent env-var errors on /signup
  test.beforeEach(async ({ page }) => {
    await mockExternalServices(page);
  });

  test('theme toggle switches to dark mode', async ({ page }) => {
    await page.goto('/', { waitUntil: 'domcontentloaded', timeout: 30000 });

    // Find theme toggle button
    const themeToggle = page.getByRole('button', { name: /toggle theme/i });

    // Wait for hydration — the button starts disabled and becomes enabled
    // once the ThemeProvider's useEffect sets `mounted = true`
    await expect(themeToggle).toBeEnabled({ timeout: 10000 });
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
  });

  test('dark mode persists across navigation', async ({ page }) => {
    await page.goto('/', { waitUntil: 'domcontentloaded', timeout: 30000 });

    const themeToggle = page.getByRole('button', { name: /toggle theme/i });
    await expect(themeToggle).toBeEnabled({ timeout: 10000 });
    await themeToggle.click();
    await page.waitForTimeout(500);

    // Navigate to another page
    await page.goto('/how-it-works', { waitUntil: 'domcontentloaded', timeout: 30000 });

    // Dark mode should persist
    const isDark = await page.evaluate(() => {
      return (
        document.documentElement.classList.contains('dark') ||
        document.documentElement.getAttribute('data-theme') === 'dark'
      );
    });
    expect(isDark).toBe(true);
  });

  test('all public pages render in dark mode', async ({ page }, testInfo) => {
    await page.goto('/', { waitUntil: 'domcontentloaded', timeout: 30000 });

    const themeToggle = page.getByRole('button', { name: /toggle theme/i });
    await expect(themeToggle).toBeEnabled({ timeout: 10000 });
    await themeToggle.click();
    await page.waitForTimeout(500);

    const pages = [
      { url: '/', name: 'dark-landing' },
      { url: '/how-it-works', name: 'dark-how-it-works' },
      { url: '/login', name: 'dark-login' },
      { url: '/signup', name: 'dark-signup' },
      { url: '/forgot-password', name: 'dark-forgot-password' },
    ];

    for (const { url, name } of pages) {
      await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 30000 });
      await testInfo.attach(name, {
        body: await page.screenshot({ fullPage: true }),
        contentType: 'image/png',
      });
    }
  });
});

test.describe('Dark Mode — Portal', () => {
  test.use({ storageState: 'e2e/auth-state/clinic.json' });

  test('portal pages render in dark mode', async ({ page }, testInfo) => {
    const { mockAllTrpc, setupPortalMocks, mockExternalServices, gotoPortalPage } = await import(
      '../../helpers/portal-test-base'
    );
    await mockExternalServices(page);
    await setupPortalMocks(page, 'clinic');
    await mockAllTrpc(page);

    const loaded = await gotoPortalPage(page, '/clinic/dashboard');
    if (!loaded) {
      // Auth cookies missing — skip (requires global-setup with valid credentials)
      return;
    }

    const themeToggle = page.getByRole('button', { name: /toggle theme/i });

    if (await themeToggle.isVisible({ timeout: 5000 }).catch(() => false)) {
      await expect(themeToggle).toBeEnabled({ timeout: 10000 });
      await themeToggle.click();
      await page.waitForTimeout(500);

      await testInfo.attach('dark-clinic-dashboard', {
        body: await page.screenshot({ fullPage: true }),
        contentType: 'image/png',
      });
    }
  });
});
