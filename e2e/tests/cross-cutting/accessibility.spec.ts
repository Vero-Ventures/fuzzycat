import { expect, test } from '@playwright/test';

test.describe('Basic accessibility', () => {
  test('landing page has proper heading hierarchy', async ({ page }) => {
    await page.goto('/');

    // There should be exactly one h1
    const h1Count = await page.locator('h1').count();
    expect(h1Count).toBe(1);

    // Check that heading levels are not skipped (e.g., no h1 -> h3 without h2)
    const headings = await page
      .locator('h1, h2, h3, h4, h5, h6')
      .evaluateAll((elements) =>
        elements.map((el) => Number.parseInt(el.tagName.replace('H', ''), 10)),
      );

    expect(headings.length).toBeGreaterThan(0);

    // Verify no heading level is skipped
    for (let i = 1; i < headings.length; i++) {
      const current = headings[i];
      const previous = headings[i - 1];
      // A heading can go deeper by at most 1 level, or go back up to any level
      if (current > previous) {
        expect(current - previous).toBeLessThanOrEqual(1);
      }
    }
  });

  test('login form has associated labels', async ({ page }) => {
    await page.goto('/login');

    const inputs = page.locator('input[type="email"], input[type="password"]');
    const inputCount = await inputs.count();

    for (let i = 0; i < inputCount; i++) {
      const input = inputs.nth(i);
      const hasLabel = await input.evaluate((el) => {
        const id = el.id;
        const hasAssociatedLabel = id ? !!document.querySelector(`label[for="${id}"]`) : false;
        const hasAriaLabel = !!el.getAttribute('aria-label');
        const hasAriaLabelledBy = !!el.getAttribute('aria-labelledby');
        const hasParentLabel = !!el.closest('label');
        return hasAssociatedLabel || hasAriaLabel || hasAriaLabelledBy || hasParentLabel;
      });

      expect(hasLabel).toBe(true);
    }
  });

  test('signup form has associated labels', async ({ page }) => {
    await page.goto('/signup');

    const inputs = page.locator(
      'input[type="email"], input[type="password"], input[type="text"], input[type="tel"]',
    );
    const inputCount = await inputs.count();

    for (let i = 0; i < inputCount; i++) {
      const input = inputs.nth(i);
      const hasLabel = await input.evaluate((el) => {
        const id = el.id;
        const hasAssociatedLabel = id ? !!document.querySelector(`label[for="${id}"]`) : false;
        const hasAriaLabel = !!el.getAttribute('aria-label');
        const hasAriaLabelledBy = !!el.getAttribute('aria-labelledby');
        const hasParentLabel = !!el.closest('label');
        return hasAssociatedLabel || hasAriaLabel || hasAriaLabelledBy || hasParentLabel;
      });

      expect(hasLabel).toBe(true);
    }
  });

  test('interactive elements are keyboard focusable', async ({ page }) => {
    await page.goto('/login');

    // Tab through the login form and verify focus moves to interactive elements
    const emailInput = page.locator('input[type="email"]');
    const passwordInput = page.locator('input[type="password"]');
    const submitButton = page.getByRole('button', {
      name: /log in|sign in|submit/i,
    });

    // Focus the email input first
    await emailInput.focus();
    await expect(emailInput).toBeFocused();

    // Tab to password
    await page.keyboard.press('Tab');
    await expect(passwordInput).toBeFocused();

    // Tab to submit button (may need extra tabs for intermediate elements)
    let foundSubmit = false;
    for (let i = 0; i < 5; i++) {
      await page.keyboard.press('Tab');
      if (await submitButton.evaluate((el) => el === document.activeElement)) {
        foundSubmit = true;
        break;
      }
    }

    expect(foundSubmit).toBe(true);
  });
});
