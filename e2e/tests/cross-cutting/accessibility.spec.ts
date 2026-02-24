import { expect, test } from '@playwright/test';
import { mockExternalServices } from '../../helpers/portal-test-base';

test.describe('Basic accessibility', () => {
  // Mock external services to prevent env-var errors on /signup
  test.beforeEach(async ({ page }) => {
    await mockExternalServices(page);
  });

  test('interactive elements are keyboard focusable', async ({ page }) => {
    await page.goto('/login', { waitUntil: 'domcontentloaded', timeout: 30000 });

    // Tab through the login form and verify focus moves to interactive elements
    const emailInput = page.locator('input[type="email"]');
    const passwordInput = page.locator('input[type="password"]');
    const submitButton = page.getByRole('button', {
      name: /sign in|log in|submit/i,
    });

    // Focus the email input first
    await emailInput.focus();
    await expect(emailInput).toBeFocused();

    // Tab to password
    await page.keyboard.press('Tab');
    await expect(passwordInput).toBeFocused();

    // Tab to submit button (may need extra tabs for the "Forgot your password?" link)
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
