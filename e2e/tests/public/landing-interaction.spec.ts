import { expect, test } from '@playwright/test';

test.describe('Landing Page — Interactions', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/', { waitUntil: 'domcontentloaded', timeout: 30000 });
    // Wait for React hydration so Next.js Link components are interactive
    await page.waitForTimeout(1000);
  });

  test('"Pet Owner Portal Login" button navigates to /login/owner', async ({ page }) => {
    const cta = page.locator('a[href="/login/owner"]', {
      hasText: /pet owner portal login/i,
    });
    await expect(cta).toBeVisible();
    await cta.click();
    await expect(page).toHaveURL(/\/login\/owner/);
  });

  test('"Clinic Portal Login" button navigates to /login/clinic', async ({ page }) => {
    const cta = page.locator('a[href="/login/clinic"]', {
      hasText: /clinic portal login/i,
    });
    await expect(cta).toBeVisible();
    await cta.click();
    await expect(page).toHaveURL(/\/login\/clinic/);
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

  test('"Get Started" bottom CTA navigates to /signup/owner', async ({ page }) => {
    const cta = page.locator('main a[href="/signup/owner"]', {
      hasText: /get started/i,
    });
    await cta.last().scrollIntoViewIfNeeded();
    await expect(cta.last()).toBeVisible();
    await cta.last().click();
    await expect(page).toHaveURL(/\/signup\/owner/);
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
