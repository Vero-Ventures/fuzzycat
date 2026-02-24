import { expect, test } from '@playwright/test';

test.describe('Clinic Clients', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/clinic/clients');
  });

  test('loads clients page', async ({ page }) => {
    await expect(page.getByRole('heading', { name: /clients/i })).toBeVisible();
    await expect(page).toHaveURL(/\/clinic\/clients/);
  });

  test('shows page description', async ({ page }) => {
    const description = page.getByText(/view all pet owners with payment plans/i);
    await expect(description).toBeVisible();
  });

  test('has client list area', async ({ page }) => {
    // The ClientList component renders a card with "Client Plans" title
    const clientPlansHeading = page.getByText(/client plans/i);
    await expect(clientPlansHeading).toBeVisible({ timeout: 10000 });

    // Should have a search input for filtering clients
    const searchInput = page.getByPlaceholder(/search by owner name/i);
    await expect(searchInput).toBeVisible({ timeout: 10000 });
  });

  test('captures screenshot', async ({ page }, testInfo) => {
    await page.waitForLoadState('domcontentloaded');

    await testInfo.attach('clinic-clients', {
      body: await page.screenshot(),
      contentType: 'image/png',
    });
  });
});
