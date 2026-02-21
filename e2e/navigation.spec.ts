import { expect, test } from '@playwright/test';

test.describe('Cross-page navigation', () => {
  test('landing page → signup via CTA', async ({ page }) => {
    await page.goto('/');
    await page.getByRole('link', { name: /split my vet bill/i }).click();
    await page.waitForURL(/\/signup/);
    expect(page.url()).toContain('/signup');
  });

  test('landing page → how it works via CTA', async ({ page }) => {
    await page.goto('/');
    await page.getByRole('link', { name: /see how it works/i }).click();
    await page.waitForURL(/\/how-it-works/);
    expect(page.url()).toContain('/how-it-works');
  });

  test('login page → signup link', async ({ page }) => {
    await page.goto('/login');
    await page.getByRole('link', { name: /sign up|create an account/i }).click();
    await page.waitForURL(/\/signup/);
    expect(page.url()).toContain('/signup');
  });

  test('signup page → login link', async ({ page }) => {
    await page.goto('/signup');
    await page.getByRole('link', { name: /log in|sign in/i }).click();
    await page.waitForURL(/\/login/);
    expect(page.url()).toContain('/login');
  });

  test('login page → forgot password', async ({ page }) => {
    await page.goto('/login');
    await page.getByRole('link', { name: /forgot your password/i }).click();
    await page.waitForURL(/\/forgot-password/);
    expect(page.url()).toContain('/forgot-password');
  });

  test('how-it-works → signup via clinic CTA', async ({ page }) => {
    await page.goto('/how-it-works');
    const partnerBtn = page.getByRole('link', { name: /become a partner clinic/i });
    if (await partnerBtn.isVisible()) {
      await partnerBtn.click();
      await page.waitForURL(/\/signup/);
      expect(page.url()).toContain('/signup');
    }
  });
});

test.describe('API health endpoint', () => {
  test('responds with JSON status', async ({ request }) => {
    const response = await request.get('/api/health');
    // May be 200 or 503 depending on env config, but should always respond
    expect([200, 503]).toContain(response.status());
    const body = await response.json();
    expect(body).toHaveProperty('status');
    expect(body).toHaveProperty('checks');
    expect(['ok', 'degraded']).toContain(body.status);
  });
});

test.describe('404 handling', () => {
  test('non-existent route shows 404 page', async ({ page }) => {
    const response = await page.goto('/this-page-does-not-exist');
    expect(response?.status()).toBe(404);
  });
});
