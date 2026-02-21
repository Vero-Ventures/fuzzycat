import { expect, test } from '@playwright/test';

test.describe('How It Works page', () => {
  test('shows page header', async ({ page }, testInfo) => {
    await page.goto('/how-it-works');

    await expect(page.locator('h1')).toContainText('How FuzzyCat Works');

    const screenshot = await page.screenshot({ fullPage: true });
    await testInfo.attach('page-header', {
      body: screenshot,
      contentType: 'image/png',
    });
  });

  test('shows pet owner steps', async ({ page }, testInfo) => {
    await page.goto('/how-it-works');

    await expect(page.getByText('Visit your vet')).toBeVisible();
    await expect(page.getByText('Enroll online')).toBeVisible();
    await expect(page.getByText('Pay 25% deposit')).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Biweekly payments' })).toBeVisible();

    const screenshot = await page.screenshot({ fullPage: true });
    await testInfo.attach('pet-owner-steps', {
      body: screenshot,
      contentType: 'image/png',
    });
  });

  test('shows payment calculator', async ({ page }, testInfo) => {
    await page.goto('/how-it-works');

    await expect(page.getByText('Try the payment calculator')).toBeVisible();
    await expect(
      page.getByText('Enter your vet bill to see exactly what you would pay'),
    ).toBeVisible();
    await expect(page.locator('#bill-amount')).toBeVisible();

    const screenshot = await page.screenshot({ fullPage: true });
    await testInfo.attach('payment-calculator', {
      body: screenshot,
      contentType: 'image/png',
    });
  });

  test('shows clinic benefits', async ({ page }, testInfo) => {
    await page.goto('/how-it-works');

    // Multiple elements contain "3%" so use first() to avoid strict mode violation
    await expect(page.getByText('3%', { exact: false }).first()).toBeVisible();
    await expect(page.getByText('Guaranteed payment').first()).toBeVisible();

    const screenshot = await page.screenshot({ fullPage: true });
    await testInfo.attach('clinic-benefits', {
      body: screenshot,
      contentType: 'image/png',
    });
  });

  test('shows FAQ section', async ({ page }, testInfo) => {
    await page.goto('/how-it-works');

    await expect(page.getByText('Frequently Asked Questions')).toBeVisible();

    // Verify at least 5 FAQ items exist
    await expect(page.getByText('What is FuzzyCat?')).toBeVisible();
    await expect(page.getByText('What fees do I pay?')).toBeVisible();
    await expect(page.getByText('Do you run a credit check?')).toBeVisible();
    await expect(page.getByText('Is there a minimum bill amount?')).toBeVisible();
    await expect(page.getByText('What payment methods are accepted?')).toBeVisible();

    const screenshot = await page.screenshot({ fullPage: true });
    await testInfo.attach('faq-section', {
      body: screenshot,
      contentType: 'image/png',
    });
  });

  test('FAQ items expand on click', async ({ page }, testInfo) => {
    await page.goto('/how-it-works');

    // Click the first FAQ item
    const faqTrigger = page.getByText('What is FuzzyCat?');
    await faqTrigger.click();

    // Verify the expanded content is visible
    await expect(page.getByText('We are not a lender')).toBeVisible();

    const screenshot = await page.screenshot({ fullPage: true });
    await testInfo.attach('faq-expanded', {
      body: screenshot,
      contentType: 'image/png',
    });
  });

  test('shows bottom CTAs', async ({ page }, testInfo) => {
    await page.goto('/how-it-works');

    await expect(page.getByRole('link', { name: /sign up as pet owner/i })).toBeVisible();
    await expect(page.getByRole('link', { name: /register your clinic/i })).toBeVisible();

    const screenshot = await page.screenshot({ fullPage: true });
    await testInfo.attach('bottom-ctas', {
      body: screenshot,
      contentType: 'image/png',
    });
  });
});
