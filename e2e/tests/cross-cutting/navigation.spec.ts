import { expect, test } from '@playwright/test';

test.describe('Cross-page navigation', () => {
  test('landing -> signup CTA', async ({ page }, testInfo) => {
    await page.goto('/');

    const splitBillCta = page.getByRole('link', {
      name: /split my vet bill/i,
    });
    await expect(splitBillCta).toBeVisible();
    await splitBillCta.click();

    await expect(page).toHaveURL(/\/signup/);

    const screenshot = await page.screenshot({ fullPage: true });
    await testInfo.attach('landing-to-signup', {
      body: screenshot,
      contentType: 'image/png',
    });
  });

  test('landing -> how-it-works CTA', async ({ page }, testInfo) => {
    await page.goto('/');

    const howItWorksCta = page.getByRole('link', {
      name: /see how it works/i,
    });
    await expect(howItWorksCta).toBeVisible();
    await howItWorksCta.click();

    await expect(page).toHaveURL(/\/how-it-works/);

    const screenshot = await page.screenshot({ fullPage: true });
    await testInfo.attach('landing-to-how-it-works', {
      body: screenshot,
      contentType: 'image/png',
    });
  });

  test('login -> signup link', async ({ page }, testInfo) => {
    await page.goto('/login');

    const signupLink = page.getByRole('link', {
      name: /sign up|create.*account|register/i,
    });
    await expect(signupLink).toBeVisible();
    await signupLink.click();

    await expect(page).toHaveURL(/\/signup/);

    const screenshot = await page.screenshot({ fullPage: true });
    await testInfo.attach('login-to-signup', {
      body: screenshot,
      contentType: 'image/png',
    });
  });

  test('signup -> login link', async ({ page }, testInfo) => {
    await page.goto('/signup');

    const loginLink = page.getByRole('link', {
      name: /log in|sign in|already have.*account/i,
    });
    await expect(loginLink).toBeVisible();
    await loginLink.click();

    await expect(page).toHaveURL(/\/login/);

    const screenshot = await page.screenshot({ fullPage: true });
    await testInfo.attach('signup-to-login', {
      body: screenshot,
      contentType: 'image/png',
    });
  });

  test('login -> forgot password', async ({ page }, testInfo) => {
    await page.goto('/login');

    const forgotLink = page.getByRole('link', {
      name: /forgot.*password|reset.*password/i,
    });
    await expect(forgotLink).toBeVisible();
    await forgotLink.click();

    await expect(page).toHaveURL(/\/forgot-password/);

    const screenshot = await page.screenshot({ fullPage: true });
    await testInfo.attach('login-to-forgot-password', {
      body: screenshot,
      contentType: 'image/png',
    });
  });

  test('captures screenshots at each navigation point', async ({ page }, testInfo) => {
    // Landing page
    await page.goto('/');
    await testInfo.attach('nav-landing', {
      body: await page.screenshot({ fullPage: true }),
      contentType: 'image/png',
    });

    // Login page
    await page.goto('/login');
    await testInfo.attach('nav-login', {
      body: await page.screenshot({ fullPage: true }),
      contentType: 'image/png',
    });

    // Signup page
    await page.goto('/signup');
    await testInfo.attach('nav-signup', {
      body: await page.screenshot({ fullPage: true }),
      contentType: 'image/png',
    });

    // How it works page
    await page.goto('/how-it-works');
    await testInfo.attach('nav-how-it-works', {
      body: await page.screenshot({ fullPage: true }),
      contentType: 'image/png',
    });

    // Forgot password page
    await page.goto('/forgot-password');
    await testInfo.attach('nav-forgot-password', {
      body: await page.screenshot({ fullPage: true }),
      contentType: 'image/png',
    });
  });
});
