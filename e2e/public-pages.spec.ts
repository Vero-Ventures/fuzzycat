import { expect, test } from '@playwright/test';

test.describe('Landing page', () => {
  test('renders hero section with correct content', async ({ page }) => {
    await page.goto('/');
    await expect(page.locator('h1')).toContainText('Your pet deserves care');
    await expect(page.getByText('No credit check required')).toBeVisible();
    await expect(page.getByText('Split your vet bill into 6 easy biweekly payments')).toBeVisible();
  });

  test('has working CTA buttons', async ({ page }) => {
    await page.goto('/');
    const splitBillCta = page.getByRole('link', { name: /split my vet bill/i });
    await expect(splitBillCta).toBeVisible();
    await expect(splitBillCta).toHaveAttribute('href', /signup/);

    const howItWorksCta = page.getByRole('link', { name: /see how it works/i });
    await expect(howItWorksCta).toBeVisible();
    await expect(howItWorksCta).toHaveAttribute('href', /how-it-works/);
  });

  test('shows three-step overview section', async ({ page }) => {
    await page.goto('/');
    await expect(page.getByText('Three steps to peace of mind')).toBeVisible();
    await expect(page.getByText('Enroll online')).toBeVisible();
    await expect(page.getByText('Automatic payments')).toBeVisible();
    await expect(page.getByText('Done in 12 weeks')).toBeVisible();
  });

  test('shows transparent pricing section', async ({ page }) => {
    await page.goto('/');
    await expect(page.getByText('Transparent pricing. No tricks.')).toBeVisible();
    await expect(page.getByText('Flat 6% Fee', { exact: true })).toBeVisible();
    await expect(page.getByText('No Credit Check', { exact: true })).toBeVisible();
    await expect(page.getByText('12-Week Plan')).toBeVisible();
  });

  test('shows clinic CTA section', async ({ page }) => {
    await page.goto('/');
    await expect(page.getByText('Get paid to offer payment plans')).toBeVisible();
    await expect(page.getByText('3% revenue share')).toBeVisible();
  });

  test('has no console errors', async ({ page }) => {
    const errors: string[] = [];
    page.on('console', (msg) => {
      if (msg.type() === 'error') errors.push(msg.text());
    });
    await page.goto('/', { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(1000);
    const real = errors.filter(
      (e) => !e.includes('monitoring') && !e.includes('posthog') && !e.includes('favicon'),
    );
    expect(real).toHaveLength(0);
  });

  test('navigation links to login and signup exist', async ({ page }) => {
    await page.goto('/');
    await expect(page.getByRole('link', { name: /log in/i })).toBeVisible();
    await expect(page.getByRole('link', { name: /sign up|get started/i }).first()).toBeVisible();
  });
});

test.describe('How It Works page', () => {
  test('renders main heading and sections', async ({ page }) => {
    await page.goto('/how-it-works');
    await expect(page.locator('h1')).toContainText('How FuzzyCat Works');
    await expect(page.getByText('For Pet Owners').first()).toBeVisible();
    await expect(page.getByText('For Veterinary Clinics').first()).toBeVisible();
  });

  test('shows pet owner 4-step flow', async ({ page }) => {
    await page.goto('/how-it-works');
    await expect(page.getByText('Visit your vet')).toBeVisible();
    await expect(page.getByText('Enroll online')).toBeVisible();
    await expect(page.getByText('Pay 25% deposit')).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Biweekly payments' })).toBeVisible();
  });

  test('shows payment calculator', async ({ page }) => {
    await page.goto('/how-it-works');
    await expect(page.getByText('Try the payment calculator')).toBeVisible();
    await expect(
      page.getByText('Enter your vet bill to see exactly what you would pay'),
    ).toBeVisible();
  });

  test('shows FAQ section with expandable items', async ({ page }) => {
    await page.goto('/how-it-works');
    await expect(page.getByText('Frequently Asked Questions')).toBeVisible();
    // Click first FAQ item and verify it expands
    const firstFaq = page.getByText('What is FuzzyCat?');
    await expect(firstFaq).toBeVisible();
    await firstFaq.click();
    await expect(page.getByText('We are not a lender')).toBeVisible();
  });

  test('shows clinic benefits', async ({ page }) => {
    await page.goto('/how-it-works');
    await expect(page.getByText('Guaranteed payment', { exact: true })).toBeVisible();
    await expect(page.getByText('Fast payouts', { exact: true })).toBeVisible();
  });
});

test.describe('Forgot Password page', () => {
  test('renders reset form', async ({ page }) => {
    await page.goto('/forgot-password');
    await expect(page.locator('h1, h2').first()).toContainText(/reset your password/i);
    await expect(page.locator('input[type="email"]')).toBeVisible();
    await expect(page.getByRole('button', { name: /send reset link/i })).toBeVisible();
  });

  test('shows validation for empty email submission', async ({ page }) => {
    await page.goto('/forgot-password');
    // HTML5 validation should prevent empty submission
    const emailInput = page.locator('input[type="email"]');
    await expect(emailInput).toHaveAttribute('required', '');
  });

  test('has back to login link', async ({ page }) => {
    await page.goto('/forgot-password');
    const loginLink = page.getByRole('link', { name: /log in|back to login|sign in/i });
    await expect(loginLink).toBeVisible();
  });
});
