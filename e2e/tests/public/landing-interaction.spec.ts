import { expect, test } from '@playwright/test';

test.describe('Landing Page — Interactions', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
  });

  test('"Start My Payment Plan" button navigates to /signup', async ({ page }) => {
    const cta = page.getByRole('link', { name: /start my payment plan/i });
    await expect(cta).toBeVisible();
    await cta.click();
    await expect(page).toHaveURL(/\/signup/);
  });

  test('"See How It Works" button navigates to /how-it-works', async ({ page }) => {
    const cta = page.getByRole('link', { name: /see how it works/i });
    await expect(cta).toBeVisible();
    await cta.click();
    await expect(page).toHaveURL(/\/how-it-works/);
  });

  test('"Partner With FuzzyCat" button navigates to /signup', async ({ page }) => {
    const cta = page.getByRole('link', { name: /partner with fuzzycat/i });
    await expect(cta).toBeVisible();
    await cta.click();
    await expect(page).toHaveURL(/\/signup/);
  });

  test('"Get Started" bottom CTA navigates to /signup', async ({ page }) => {
    const cta = page.getByRole('link', { name: /get started/i });
    await expect(cta).toBeVisible();
    await cta.click();
    await expect(page).toHaveURL(/\/signup/);
  });

  test('"Learn More" bottom CTA navigates to /how-it-works', async ({ page }) => {
    const cta = page.getByRole('link', { name: /learn more/i });
    await expect(cta).toBeVisible();
    await cta.click();
    await expect(page).toHaveURL(/\/how-it-works/);
  });

  test('hero badge shows "No credit check required"', async ({ page }) => {
    await expect(page.getByText('No credit check required')).toBeVisible();
  });

  test('fee section shows "Flat 6% Fee", "No Credit Check", "12-Week Plan"', async ({ page }) => {
    await expect(page.getByText('Flat 6% Fee')).toBeVisible();
    await expect(page.getByText('No Credit Check', { exact: true })).toBeVisible();
    await expect(page.getByText('12-Week Plan')).toBeVisible();
  });
});
