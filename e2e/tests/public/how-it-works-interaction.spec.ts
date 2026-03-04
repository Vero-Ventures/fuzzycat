import { expect, test } from '@playwright/test';
import { CLINIC_SHARE_PERCENT } from '@/lib/constants';

test.describe('How It Works — Interactions', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/how-it-works');
  });

  test('"Become a Partner Clinic" CTA navigates to /signup/clinic', async ({ page }) => {
    const cta = page.getByRole('link', { name: /become a partner clinic/i });
    await expect(cta).toBeVisible();
    await cta.click();
    await expect(page).toHaveURL(/\/signup\/clinic/);
  });

  test('"Sign Up as Client" CTA navigates to /signup/client', async ({ page }) => {
    const cta = page.getByRole('link', { name: /sign up as client/i });
    await expect(cta).toBeVisible();
    await cta.click();
    await expect(page).toHaveURL(/\/signup\/client/);
  });

  test('clinic benefits section shows key value props', async ({ page }) => {
    // Clinic share percentage — uses first() because multiple elements may contain it
    await expect(
      page.getByText(`${CLINIC_SHARE_PERCENT}%`, { exact: false }).first(),
    ).toBeVisible();
    await expect(page.getByText(`Earn ${CLINIC_SHARE_PERCENT}% on every enrollment`)).toBeVisible();
    await expect(page.getByText('Automated payment recovery')).toBeVisible();
    await expect(page.getByText('Fast payouts')).toBeVisible();
  });

  test('client steps show all 4 steps in order', async ({ page }) => {
    const step1 = page.getByText('Visit your vet');
    const step2 = page.getByText('Enroll online');
    const step3 = page.getByText('Pay 25% deposit');
    const step4 = page.getByRole('heading', { name: 'Biweekly payments' });

    await expect(step1).toBeVisible();
    await expect(step2).toBeVisible();
    await expect(step3).toBeVisible();
    await expect(step4).toBeVisible();

    // Verify correct ordering: each step label appears before the next in the DOM
    const stepLabels = page.locator('text=/Step [1-4]/');
    const labels = await stepLabels.allTextContents();
    const stepNumbers = labels.map((label) => Number.parseInt(label.replace('Step ', ''), 10));

    // Filter to only valid step numbers and verify they appear in ascending order
    const validSteps = stepNumbers.filter((n) => n >= 1 && n <= 4);
    expect(validSteps.length).toBeGreaterThanOrEqual(4);
    for (let i = 1; i < validSteps.length; i++) {
      expect(validSteps[i]).toBeGreaterThanOrEqual(validSteps[i - 1]);
    }
  });
});
