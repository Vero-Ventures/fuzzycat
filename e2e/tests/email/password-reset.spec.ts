import { expect, test } from '@playwright/test';
import {
  clearMailbox,
  extractLinks,
  getEmailHtml,
  isMailpitAvailable,
  waitForEmail,
} from '@/lib/test-utils/mailpit';

const TEST_EMAIL = process.env.E2E_CLIENT_EMAIL ?? 'e2e-client@fuzzycatapp.com';

test.beforeAll(async () => {
  const available = await isMailpitAvailable();
  test.skip(!available, 'Mailpit is not available — skipping email tests');
});

test.beforeEach(async () => {
  await clearMailbox();
});

test.describe('Password reset email flow', () => {
  test('sends password reset email and contains valid reset link', async ({ page }) => {
    // 1. Navigate to forgot password page
    await page.goto('/forgot-password');
    await expect(page.getByRole('heading', { name: /reset|forgot/i })).toBeVisible();

    // 2. Submit the password reset form
    await page.getByLabel(/email/i).fill(TEST_EMAIL);
    await page.getByRole('button', { name: /reset|send/i }).click();

    // 3. Wait for success confirmation on the page
    await expect(page.getByText(/check your email|reset link|sent/i)).toBeVisible({
      timeout: 10_000,
    });

    // 4. Query Mailpit for the password reset email
    const email = await waitForEmail({
      to: TEST_EMAIL,
      subject: 'reset',
      timeout: 15_000,
    });

    expect(email.Subject.toLowerCase()).toContain('reset');
    expect(email.To[0].Address).toBe(TEST_EMAIL);

    // 5. Get the full email HTML and extract links
    const html = await getEmailHtml(email.ID);
    expect(html).toBeTruthy();

    const links = extractLinks(html);
    const resetLink = links.find(
      (link) => link.includes('reset') || link.includes('token') || link.includes('recovery'),
    );

    expect(resetLink).toBeDefined();

    // 6. Navigate to the reset link and verify the page loads
    if (resetLink) {
      await page.goto(resetLink);
      // The reset page should load without errors
      await expect(page.locator('body')).not.toContainText('404');
      await expect(page.locator('body')).not.toContainText('error');
    }
  });
});
