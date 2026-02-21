import { expect, test } from '@playwright/test';

// This file runs under the "mobile" project which uses Pixel 5 device config

test.describe('Mobile responsive', () => {
  test('landing page renders on mobile', async ({ page }, testInfo) => {
    await page.goto('/');

    // Hero section should be visible on mobile
    await expect(page.locator('h1')).toBeVisible();
    await expect(page.getByText('No credit check required')).toBeVisible();

    const screenshot = await page.screenshot({ fullPage: true });
    await testInfo.attach('mobile-landing', {
      body: screenshot,
      contentType: 'image/png',
    });
  });

  test('navigation works on mobile', async ({ page }, testInfo) => {
    await page.goto('/');

    // Navigate to how-it-works
    const howItWorksCta = page.getByRole('link', {
      name: /see how it works/i,
    });
    await expect(howItWorksCta).toBeVisible();
    await howItWorksCta.click();
    await expect(page).toHaveURL(/\/how-it-works/);

    await testInfo.attach('mobile-how-it-works', {
      body: await page.screenshot({ fullPage: true }),
      contentType: 'image/png',
    });

    // Navigate to login
    await page.goto('/login');
    await expect(page).toHaveURL(/\/login/);

    await testInfo.attach('mobile-login-nav', {
      body: await page.screenshot({ fullPage: true }),
      contentType: 'image/png',
    });
  });

  test('login page renders on mobile', async ({ page }, testInfo) => {
    await page.goto('/login');

    // Form should be usable on mobile
    await expect(page.locator('input[type="email"]')).toBeVisible();
    await expect(page.locator('input[type="password"]')).toBeVisible();
    await expect(page.getByRole('button', { name: /log in|sign in|submit/i })).toBeVisible();

    const screenshot = await page.screenshot({ fullPage: true });
    await testInfo.attach('mobile-login', {
      body: screenshot,
      contentType: 'image/png',
    });
  });

  test('signup page renders on mobile', async ({ page }, testInfo) => {
    await page.goto('/signup');

    // Form should be usable on mobile
    await expect(page.locator('input[type="email"]')).toBeVisible();
    await expect(page.locator('input[type="password"]')).toBeVisible();
    await expect(
      page.getByRole('button', {
        name: /sign up|create.*account|register|submit/i,
      }),
    ).toBeVisible();

    const screenshot = await page.screenshot({ fullPage: true });
    await testInfo.attach('mobile-signup', {
      body: screenshot,
      contentType: 'image/png',
    });
  });

  test('captures mobile screenshots', async ({ page }, testInfo) => {
    const pages = [
      { url: '/', name: 'mobile-full-landing' },
      { url: '/how-it-works', name: 'mobile-full-how-it-works' },
      { url: '/login', name: 'mobile-full-login' },
      { url: '/signup', name: 'mobile-full-signup' },
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
});
