import { expect, test } from '@playwright/test';

test.describe('Landing Page — Interactions', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/', { waitUntil: 'domcontentloaded', timeout: 30000 });
    // Wait for React hydration so Next.js Link components are interactive
    await page.waitForTimeout(1000);
  });

  test('"Log In" button navigates to /login', async ({ page }) => {
    const cta = page.locator('a[href="/login"]', {
      hasText: /log in/i,
    });
    await expect(cta).toBeVisible();
    await cta.click();
    await expect(page).toHaveURL(/\/login/);
  });

  test('"Partner With FuzzyCat" button navigates to /signup/clinic', async ({ page }) => {
    const cta = page.locator('a[href="/signup/clinic"]', {
      hasText: /partner with fuzzycat/i,
    });
    await cta.scrollIntoViewIfNeeded();
    await expect(cta).toBeVisible();
    await cta.click();
    await expect(page).toHaveURL(/\/signup\/clinic/);
  });

  test('"Get Started" bottom CTA navigates to /signup/client', async ({ page }) => {
    const cta = page.locator('main a[href="/signup/client"]', {
      hasText: /get started/i,
    });
    await cta.last().scrollIntoViewIfNeeded();
    await expect(cta.last()).toBeVisible();
    await cta.last().click();
    await expect(page).toHaveURL(/\/signup\/client/);
  });

  test('"Learn More" bottom CTA navigates to /how-it-works', async ({ page }) => {
    const cta = page.locator('a[href="/how-it-works"]', {
      hasText: /learn more/i,
    });
    await cta.scrollIntoViewIfNeeded();
    await expect(cta).toBeVisible();
    await cta.click();
    await expect(page).toHaveURL(/\/how-it-works/);
  });
});
