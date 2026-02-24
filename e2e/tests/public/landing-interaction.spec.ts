import { expect, test } from '@playwright/test';

test.describe('Landing Page — Interactions', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/', { waitUntil: 'domcontentloaded', timeout: 30000 });
    // Wait for React hydration so Next.js Link components are interactive
    await page.waitForTimeout(1000);
  });

  test('"Start My Payment Plan" button navigates to /signup', async ({ page }) => {
    // Use CSS selector for the <a> to avoid <button> inside <a> click issues
    const cta = page.locator('a[href="/signup"]', {
      hasText: /start my payment plan/i,
    });
    await expect(cta).toBeVisible();
    await cta.click();
    await expect(page).toHaveURL(/\/signup/);
  });

  test('"See How It Works" button navigates to /how-it-works', async ({ page }) => {
    const cta = page.locator('a[href="/how-it-works"]', {
      hasText: /see how it works/i,
    });
    await cta.scrollIntoViewIfNeeded();
    await expect(cta).toBeVisible();
    await cta.click();
    await expect(page).toHaveURL(/\/how-it-works/);
  });

  test('"Partner With FuzzyCat" button navigates to /signup', async ({ page }) => {
    const cta = page.locator('a[href="/signup"]', {
      hasText: /partner with fuzzycat/i,
    });
    await cta.scrollIntoViewIfNeeded();
    await expect(cta).toBeVisible();
    await cta.click();
    await expect(page).toHaveURL(/\/signup/);
  });

  test('"Get Started" bottom CTA navigates to /signup', async ({ page }) => {
    // "Get Started" appears in both header nav and bottom CTA; target the bottom one
    const cta = page.locator('main a[href="/signup"]', {
      hasText: /get started/i,
    });
    await cta.last().scrollIntoViewIfNeeded();
    await expect(cta.last()).toBeVisible();
    await cta.last().click();
    await expect(page).toHaveURL(/\/signup/);
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
