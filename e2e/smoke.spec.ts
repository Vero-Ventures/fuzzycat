import { expect, test } from '@playwright/test';

test.describe('smoke tests', () => {
  test('homepage renders', async ({ page }) => {
    await page.goto('/');
    await expect(page).toHaveTitle(/FuzzyCat/);
  });

  test('login page renders', async ({ page }) => {
    await page.goto('/login');
    await expect(page.locator('body')).toBeVisible();
  });

  test('protected clinic route redirects to login', async ({ page }) => {
    await page.goto('/clinic/dashboard');
    await page.waitForURL('**/login');
  });

  test('protected owner route redirects to login', async ({ page }) => {
    await page.goto('/owner/payments');
    await page.waitForURL('**/login');
  });

  test('protected admin route redirects to login', async ({ page }) => {
    await page.goto('/admin/dashboard');
    await page.waitForURL('**/login');
  });
});
