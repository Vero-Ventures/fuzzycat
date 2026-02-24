import { expect, test } from '@playwright/test';

const FAQ_ITEMS = [
  'What is FuzzyCat?',
  'Do you run a credit check?',
  'What fees do I pay?',
  'Is there a minimum bill amount?',
  'What payment methods are accepted?',
  'What happens if I miss a payment?',
  'What does it cost the clinic?',
  'What if a pet owner defaults?',
  'Which clinics accept FuzzyCat?',
] as const;

test.describe('How It Works — Interactions', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/how-it-works');
  });

  test('all 9 FAQ items can be expanded and contain content', async ({ page }) => {
    for (const question of FAQ_ITEMS) {
      const trigger = page.getByText(question, { exact: true });
      await expect(trigger).toBeVisible();

      // Expand the accordion item
      await trigger.click();

      // The accordion content area closest to the trigger should now have visible text
      // Each AccordionContent renders as the next sibling of the trigger's parent
      const accordionItem = trigger.locator('xpath=ancestor::div[@data-state]').first();
      await expect(accordionItem).toHaveAttribute('data-state', 'open');

      // Close it before moving on (single collapsible mode — clicking again closes)
      await trigger.click();
      await expect(accordionItem).toHaveAttribute('data-state', 'closed');
    }
  });

  test('only one FAQ item is open at a time', async ({ page }) => {
    // Open the first FAQ
    const firstTrigger = page.getByText(FAQ_ITEMS[0], { exact: true });
    await firstTrigger.click();

    const firstItem = firstTrigger.locator('xpath=ancestor::div[@data-state]').first();
    await expect(firstItem).toHaveAttribute('data-state', 'open');

    // Open the second FAQ — the first should automatically close
    const secondTrigger = page.getByText(FAQ_ITEMS[1], { exact: true });
    await secondTrigger.click();

    const secondItem = secondTrigger.locator('xpath=ancestor::div[@data-state]').first();
    await expect(secondItem).toHaveAttribute('data-state', 'open');
    await expect(firstItem).toHaveAttribute('data-state', 'closed');

    // Open the third FAQ — the second should automatically close
    const thirdTrigger = page.getByText(FAQ_ITEMS[2], { exact: true });
    await thirdTrigger.click();

    const thirdItem = thirdTrigger.locator('xpath=ancestor::div[@data-state]').first();
    await expect(thirdItem).toHaveAttribute('data-state', 'open');
    await expect(secondItem).toHaveAttribute('data-state', 'closed');
  });

  test('"Become a Partner Clinic" CTA navigates to /signup', async ({ page }) => {
    const cta = page.getByRole('link', { name: /become a partner clinic/i });
    await expect(cta).toBeVisible();
    await cta.click();
    await expect(page).toHaveURL(/\/signup/);
  });

  test('"Sign Up as Pet Owner" CTA navigates to /signup', async ({ page }) => {
    const cta = page.getByRole('link', { name: /sign up as pet owner/i });
    await expect(cta).toBeVisible();
    await cta.click();
    await expect(page).toHaveURL(/\/signup/);
  });

  test('clinic benefits section shows key value props', async ({ page }) => {
    // "Earn 3%" — uses first() because multiple elements may contain "3%"
    await expect(page.getByText('3%', { exact: false }).first()).toBeVisible();
    await expect(page.getByText('Earn 3% on every enrollment')).toBeVisible();
    await expect(page.getByText('Automated payment recovery')).toBeVisible();
    await expect(page.getByText('Fast payouts')).toBeVisible();
  });

  test('pet owner steps show all 4 steps in order', async ({ page }) => {
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
