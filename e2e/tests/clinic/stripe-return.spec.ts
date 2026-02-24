import { expect, test } from '@playwright/test';

test.describe('Clinic Stripe Return', () => {
  test('loads stripe return page', async ({ page }) => {
    await page.goto('/clinic/onboarding/stripe-return');
    await expect(page).toHaveURL(/\/clinic\/onboarding\/stripe-return/);

    // The page shows a card with a Stripe status heading — one of:
    // "Stripe Setup Complete", "Stripe Verification In Progress", or "Stripe Setup Incomplete"
    // It may also show a loading skeleton while fetching status.
    const stripeHeading = page.getByText(
      /stripe setup|stripe verification|checking.*stripe|unable to check/i,
    );
    await expect(stripeHeading).toBeVisible({ timeout: 15000 });
  });

  test('captures screenshot', async ({ page }, testInfo) => {
    await page.goto('/clinic/onboarding/stripe-return');
    await page.waitForLoadState('domcontentloaded');

    await testInfo.attach('clinic-stripe-return', {
      body: await page.screenshot(),
      contentType: 'image/png',
    });
  });
});
