import { expect, test } from '@playwright/test';

test.describe('Landing page', () => {
  test('displays hero section', async ({ page }, testInfo) => {
    await page.goto('/');

    await expect(page.locator('h1')).toContainText('Your pet deserves care');
    await expect(page.getByText('No credit check required')).toBeVisible();
    await expect(page.getByRole('link', { name: /split my vet bill/i })).toBeVisible();
    await expect(page.getByRole('link', { name: /see how it works/i })).toBeVisible();

    const screenshot = await page.screenshot({ fullPage: true });
    await testInfo.attach('hero-section', {
      body: screenshot,
      contentType: 'image/png',
    });
  });

  test('shows three-step overview', async ({ page }, testInfo) => {
    await page.goto('/');

    await expect(page.getByText('Enroll online')).toBeVisible();
    await expect(page.getByText('Automatic payments')).toBeVisible();
    await expect(page.getByText('Done in 12 weeks')).toBeVisible();

    const screenshot = await page.screenshot({ fullPage: true });
    await testInfo.attach('three-step-overview', {
      body: screenshot,
      contentType: 'image/png',
    });
  });

  test('shows pricing transparency', async ({ page }, testInfo) => {
    await page.goto('/');

    // Multiple elements contain "6%" so use first() to avoid strict mode violation
    await expect(page.getByText('6%', { exact: false }).first()).toBeVisible();
    await expect(page.getByText('No Credit Check', { exact: true })).toBeVisible();
    await expect(page.getByText('12-Week Plan')).toBeVisible();

    const screenshot = await page.screenshot({ fullPage: true });
    await testInfo.attach('pricing-transparency', {
      body: screenshot,
      contentType: 'image/png',
    });
  });

  test('shows clinic CTA section', async ({ page }, testInfo) => {
    await page.goto('/');

    await expect(page.getByText('Get paid to offer payment plans')).toBeVisible();
    await expect(page.getByText('3% revenue share')).toBeVisible();

    const screenshot = await page.screenshot({ fullPage: true });
    await testInfo.attach('clinic-cta-section', {
      body: screenshot,
      contentType: 'image/png',
    });
  });

  test('hero CTAs navigate correctly', async ({ page }, testInfo) => {
    await page.goto('/');

    const splitBillCta = page.getByRole('link', {
      name: /split my vet bill/i,
    });
    await expect(splitBillCta).toHaveAttribute('href', /\/signup/);

    const howItWorksCta = page.getByRole('link', {
      name: /see how it works/i,
    });
    await expect(howItWorksCta).toHaveAttribute('href', /\/how-it-works/);

    const screenshot = await page.screenshot({ fullPage: true });
    await testInfo.attach('hero-ctas', {
      body: screenshot,
      contentType: 'image/png',
    });
  });

  test('has no console errors', async ({ page }, testInfo) => {
    const errors: string[] = [];
    page.on('console', (msg) => {
      if (msg.type() === 'error') errors.push(msg.text());
    });

    await page.goto('/', { waitUntil: 'load' });

    const realErrors = errors.filter(
      (e) =>
        !e.includes('posthog') &&
        !e.includes('sentry') &&
        !e.includes('favicon') &&
        !e.includes('monitoring'),
    );
    expect(realErrors).toHaveLength(0);

    const screenshot = await page.screenshot({ fullPage: true });
    await testInfo.attach('no-console-errors', {
      body: screenshot,
      contentType: 'image/png',
    });
  });
});
