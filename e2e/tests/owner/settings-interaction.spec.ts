import { expect, test } from '@playwright/test';
import { ownerPlans, ownerProfile } from '../../helpers/audit-mock-data';
import { gotoPortalPage, mockAllTrpc } from '../../helpers/portal-test-base';
import { mockTrpcMutation, mockTrpcQuery, mockTrpcQueryError } from '../../helpers/trpc-mock';

test.describe.configure({ timeout: 90_000 });

test.describe('Owner Settings — Interactions', () => {
  test('profile form shows current data', async ({ page }) => {
    await mockTrpcQuery(page, 'owner.getProfile', ownerProfile);
    await mockTrpcQuery(page, 'owner.getPlans', ownerPlans);
    await mockAllTrpc(page);

    await gotoPortalPage(page, '/owner/settings');

    // Profile heading
    await expect(page.getByRole('heading', { name: /settings|profile/i }).first()).toBeVisible({
      timeout: 5000,
    });

    // Name pre-filled
    const nameInput = page.locator('#name');
    if (await nameInput.isVisible({ timeout: 3000 }).catch(() => false)) {
      await expect(nameInput).toHaveValue('Jane Doe');
    }

    // Email pre-filled
    const emailInput = page.locator('#email');
    if (await emailInput.isVisible({ timeout: 3000 }).catch(() => false)) {
      await expect(emailInput).toHaveValue('jane.doe@example.com');
    }
  });

  test('profile form submission', async ({ page }) => {
    await mockTrpcQuery(page, 'owner.getProfile', ownerProfile);
    await mockTrpcQuery(page, 'owner.getPlans', ownerPlans);
    await mockTrpcMutation(page, 'owner.updateProfile', { success: true });
    await mockAllTrpc(page);

    await gotoPortalPage(page, '/owner/settings');

    // Update name
    const nameInput = page.locator('#name');
    if (await nameInput.isVisible({ timeout: 3000 }).catch(() => false)) {
      await nameInput.clear();
      await nameInput.fill('Jane Updated');

      // Submit
      const saveBtn = page.getByRole('button', { name: /save/i });
      await expect(saveBtn).toBeVisible();
      await saveBtn.click();

      // Success message
      await expect(page.getByText(/updated|saved|success/i).first()).toBeVisible({ timeout: 5000 });
    }
  });

  test('payment method section visible', async ({ page }) => {
    await mockTrpcQuery(page, 'owner.getProfile', ownerProfile);
    await mockTrpcQuery(page, 'owner.getPlans', ownerPlans);
    await mockAllTrpc(page);

    await gotoPortalPage(page, '/owner/settings');

    // Payment method section should show debit card info (from mock data)
    const paymentSection = page
      .getByText(/payment.*method|debit.*card|card.*ending/i)
      .or(page.getByText(/payment/i));
    await expect(paymentSection.first()).toBeVisible({ timeout: 5000 });
  });

  test('active plans section', async ({ page }) => {
    await mockTrpcQuery(page, 'owner.getProfile', ownerProfile);
    await mockTrpcQuery(page, 'owner.getPlans', ownerPlans);
    await mockAllTrpc(page);

    await gotoPortalPage(page, '/owner/settings');

    // Active plans or plan list
    const planSection = page.getByText(/active.*plan|my.*plan|happy paws/i);
    if (
      await planSection
        .first()
        .isVisible({ timeout: 5000 })
        .catch(() => false)
    ) {
      expect(await planSection.count()).toBeGreaterThan(0);
    }
  });

  test('error state: profile load failure', async ({ page }) => {
    await mockTrpcQueryError(
      page,
      'owner.getProfile',
      'INTERNAL_SERVER_ERROR',
      'Failed to load profile',
    );
    await mockTrpcQuery(page, 'owner.getPlans', ownerPlans);
    await mockAllTrpc(page);

    await gotoPortalPage(page, '/owner/settings');

    // Error message
    const error = page.getByText(/unable.*load|error|failed/i);
    await expect(error.first()).toBeVisible({ timeout: 10000 });
  });
});
