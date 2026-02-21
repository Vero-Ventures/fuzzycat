import { expect, test } from '@playwright/test';

test.describe('smoke tests — public pages', () => {
  test('homepage renders with correct title and heading', async ({ page }) => {
    await page.goto('/');
    await expect(page).toHaveTitle(/FuzzyCat/);
    await expect(page.locator('h1')).toContainText('Your pet deserves care');
  });

  test('homepage has no console errors', async ({ page }) => {
    const errors: string[] = [];
    page.on('console', (msg) => {
      if (msg.type() === 'error') errors.push(msg.text());
    });

    await page.goto('/');
    await expect(page.locator('h1')).toBeVisible();
    expect(errors).toEqual([]);
  });

  test('login page renders with form', async ({ page }) => {
    await page.goto('/login');
    await expect(page.locator('h1')).toHaveText(/Log in/);
    await expect(page.locator('a[href="/signup"]')).toBeVisible();
  });

  test('signup page renders', async ({ page }) => {
    await page.goto('/signup');
    await expect(page.locator('body')).toBeVisible();
    await expect(page).toHaveTitle(/FuzzyCat/);
  });
});

test.describe('smoke tests — auth redirects', () => {
  test('clinic route redirects unauthenticated users to login', async ({ page }) => {
    await page.goto('/clinic/dashboard');
    await expect(page).toHaveURL(/\/login/);
  });

  test('owner route redirects unauthenticated users to login', async ({ page }) => {
    await page.goto('/owner/payments');
    await expect(page).toHaveURL(/\/login/);
  });

  test('admin route redirects unauthenticated users to login', async ({ page }) => {
    await page.goto('/admin/dashboard');
    await expect(page).toHaveURL(/\/login/);
  });

  test('redirect preserves intended destination', async ({ page }) => {
    await page.goto('/clinic/settings');
    await expect(page).toHaveURL(/\/login\?redirectTo=%2Fclinic%2Fsettings/);
  });
});
