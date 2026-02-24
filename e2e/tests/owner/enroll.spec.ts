import { expect, test } from '@playwright/test';
import { mockTrpcQuery } from '../../helpers/trpc-mock';

test.describe('Owner Enrollment Flow', () => {
  test.beforeEach(async ({ page }) => {
    // Mock tRPC clinic search to avoid hitting real backend for search queries
    await mockTrpcQuery(page, 'clinic.search', []);

    // Block Stripe and Plaid from loading since we cannot do real payments
    await page.route('**/js.stripe.com/**', (route) =>
      route.fulfill({
        status: 200,
        contentType: 'application/javascript',
        body: 'window.Stripe = function() { return { elements: function() { return { create: function() { return { mount: function() {}, on: function() {} } } } }, confirmPayment: function() { return Promise.resolve({ paymentIntent: { status: "succeeded" } }) } } };',
      }),
    );

    await page.route('**/cdn.plaid.com/**', (route) =>
      route.fulfill({
        status: 200,
        contentType: 'application/javascript',
        body: 'window.Plaid = { create: function() { return { open: function() {}, exit: function() {}, destroy: function() {} } } };',
      }),
    );

    await page.goto('/owner/enroll');
  });

  test('loads enrollment page with heading', async ({ page }, testInfo) => {
    await expect(page.getByRole('heading', { name: /enroll in a payment plan/i })).toBeVisible();

    await testInfo.attach('enrollment-heading', {
      body: await page.screenshot(),
      contentType: 'image/png',
    });
  });

  test('shows step 1: Select Clinic', async ({ page }) => {
    // Step 1 heading within the step content
    await expect(
      page.getByRole('heading', { name: /select your veterinary clinic/i }),
    ).toBeVisible();

    // The clinic search input should be present
    await expect(page.getByPlaceholder(/happy paws veterinary/i)).toBeVisible();
  });

  test('shows progress indicator', async ({ page }) => {
    // The progress bar component
    const progressBar = page.locator('[role="progressbar"]');
    await expect(progressBar).toBeVisible();

    // Step counter text: "Step 1 of 5"
    await expect(page.getByText(/step 1 of 5/i)).toBeVisible();
  });

  test('step navigation exists', async ({ page }) => {
    // On step 1, there is a "Continue" button (no back button on first step)
    const continueButton = page.getByRole('button', { name: /continue/i });
    await expect(continueButton).toBeVisible();

    // The continue button should be disabled until a clinic is selected
    await expect(continueButton).toBeDisabled();
  });

  test('shows 5 steps total', async ({ page }, testInfo) => {
    // The step indicator shows numbers 1-5 in circular badges.
    // Verify all 5 step number indicators are present.
    const stepIndicators = page.locator('.rounded-full').filter({
      hasText: /^[1-5\u2713]$/,
    });

    await expect(stepIndicators).toHaveCount(5);

    // Verify the "Step X of 5" text confirms 5 total steps
    await expect(page.getByText(/of 5/i)).toBeVisible();

    await testInfo.attach('step-indicators', {
      body: await page.screenshot(),
      contentType: 'image/png',
    });
  });

  test('captures screenshot of enrollment start', async ({ page }, testInfo) => {
    // Wait for page to stabilize
    await page.waitForLoadState('domcontentloaded');

    await testInfo.attach('enrollment-start-full', {
      body: await page.screenshot({ fullPage: true }),
      contentType: 'image/png',
    });
  });
});
