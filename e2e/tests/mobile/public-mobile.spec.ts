import { expect, test } from '@playwright/test';

test.describe('Public Pages — Mobile', () => {
  test('landing page hero renders on mobile', async ({ page }, testInfo) => {
    await page.goto('/');

    await expect(page.locator('h1')).toBeVisible();
    await expect(page.getByText('No credit check required')).toBeVisible();

    // CTAs visible
    const paymentPlanCta = page.getByRole('link', { name: /start my payment plan/i });
    await expect(paymentPlanCta).toBeVisible();

    const howItWorksCta = page.getByRole('link', { name: /see how it works/i });
    await expect(howItWorksCta).toBeVisible();

    // No horizontal overflow
    const hasOverflow = await page.evaluate(() => {
      return document.documentElement.scrollWidth > document.documentElement.clientWidth;
    });
    expect(hasOverflow).toBe(false);

    await testInfo.attach('mobile-landing-hero', {
      body: await page.screenshot({ fullPage: true }),
      contentType: 'image/png',
    });
  });

  test('landing page pricing section on mobile', async ({ page }, testInfo) => {
    await page.goto('/');

    // Pricing section
    const pricing = page.getByText(/transparent pricing/i);
    if (await pricing.isVisible({ timeout: 5000 }).catch(() => false)) {
      await pricing.scrollIntoViewIfNeeded();
    }

    // Pricing cards should stack
    await expect(page.getByText(/flat 6% fee/i).first()).toBeVisible({ timeout: 5000 });
    await expect(page.getByText(/no credit check/i).first()).toBeVisible({ timeout: 3000 });

    await testInfo.attach('mobile-landing-pricing', {
      body: await page.screenshot({ fullPage: true }),
      contentType: 'image/png',
    });
  });

  test('landing page navigation CTAs work on mobile', async ({ page }) => {
    await page.goto('/');

    // CTA to signup
    const signupCta = page.getByRole('link', { name: /start my payment plan/i });
    await signupCta.click();
    await expect(page).toHaveURL(/\/signup/);
  });

  test('how-it-works page renders on mobile', async ({ page }, testInfo) => {
    await page.goto('/how-it-works');

    await expect(page.locator('h1')).toBeVisible();
    await expect(page.getByText(/How FuzzyCat Works/i)).toBeVisible();

    // Steps section
    await expect(page.getByText(/set up your payment plan/i)).toBeVisible({ timeout: 5000 });

    await testInfo.attach('mobile-how-it-works', {
      body: await page.screenshot({ fullPage: true }),
      contentType: 'image/png',
    });
  });

  test('payment calculator on mobile', async ({ page }, testInfo) => {
    await page.goto('/how-it-works');

    // Calculator section
    const billInput = page.locator('#bill-amount');
    if (await billInput.isVisible({ timeout: 5000 }).catch(() => false)) {
      await billInput.scrollIntoViewIfNeeded();
      await billInput.clear();
      await billInput.fill('1000');

      // Results visible
      await expect(page.getByText(/\$60/).first()).toBeVisible({ timeout: 3000 });
      await expect(page.getByText(/\$1,060|\$1060/).first()).toBeVisible({ timeout: 3000 });

      // No horizontal overflow on schedule table
      const hasOverflow = await page.evaluate(() => {
        return document.documentElement.scrollWidth > document.documentElement.clientWidth;
      });
      expect(hasOverflow).toBe(false);
    }

    await testInfo.attach('mobile-calculator', {
      body: await page.screenshot({ fullPage: true }),
      contentType: 'image/png',
    });
  });

  test('FAQ accordion on mobile', async ({ page }, testInfo) => {
    await page.goto('/how-it-works');

    // FAQ section
    const faqSection = page.getByText(/frequently asked/i);
    if (await faqSection.isVisible({ timeout: 5000 }).catch(() => false)) {
      await faqSection.scrollIntoViewIfNeeded();
    }

    // Click to expand a FAQ item
    const faqItem = page.getByText(/what is fuzzycat/i);
    if (await faqItem.isVisible({ timeout: 3000 }).catch(() => false)) {
      await faqItem.click();
      await page.waitForTimeout(500);
    }

    await testInfo.attach('mobile-faq', {
      body: await page.screenshot({ fullPage: true }),
      contentType: 'image/png',
    });
  });

  test('dark mode toggle on mobile', async ({ page }, testInfo) => {
    await page.goto('/');

    const themeToggle = page
      .getByRole('button', { name: /toggle.*theme|dark.*mode|light.*mode|theme/i })
      .or(page.locator('[aria-label*="theme"]'))
      .or(page.locator('[aria-label*="Theme"]'));

    if (await themeToggle.isVisible({ timeout: 5000 }).catch(() => false)) {
      await themeToggle.click();

      const isDark = await page.evaluate(() => {
        return (
          document.documentElement.classList.contains('dark') ||
          document.documentElement.getAttribute('data-theme') === 'dark'
        );
      });
      expect(isDark).toBe(true);

      await testInfo.attach('mobile-dark-mode', {
        body: await page.screenshot({ fullPage: true }),
        contentType: 'image/png',
      });
    }
  });
});
