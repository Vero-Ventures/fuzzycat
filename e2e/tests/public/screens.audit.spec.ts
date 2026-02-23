import { expect, test } from '@playwright/test';
import { takeScreenshot } from '../../helpers/screenshot';

const SUBDIR = 'public';

test.describe('UI Audit: Public Pages', () => {
  test('Landing page — hero, features, calculator, pricing, CTA', async ({ page }, testInfo) => {
    await page.goto('/');

    // Hero section
    await expect(page.locator('h1')).toBeVisible({ timeout: 10000 });

    // Features section — use .first() since "no credit check" appears multiple times
    await expect(page.getByText(/no credit check/i).first()).toBeVisible();

    // CTA buttons
    await expect(page.getByRole('link', { name: /start my payment plan/i }).first()).toBeVisible();

    // Calculator section
    const calculator = page.locator('#bill-amount');
    if (await calculator.isVisible({ timeout: 3000 }).catch(() => false)) {
      await calculator.fill('1200');
    }

    await takeScreenshot(page, testInfo, 'landing-full', SUBDIR);
  });

  test('How It Works page — 3-step process', async ({ page }, testInfo) => {
    await page.goto('/how-it-works');

    await expect(page.locator('h1')).toBeVisible({ timeout: 10000 });

    // Verify step content is present
    await expect(page.getByText(/step/i).first()).toBeVisible();

    await takeScreenshot(page, testInfo, 'how-it-works-full', SUBDIR);
  });
});
