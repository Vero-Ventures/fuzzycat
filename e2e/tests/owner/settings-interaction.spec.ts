import { expect, test } from '@playwright/test';
import { ownerPlans, ownerProfile } from '../../helpers/audit-mock-data';
import { gotoPortalPage, mockAllTrpc } from '../../helpers/portal-test-base';
import { mockTrpcMutation, mockTrpcMutationError, mockTrpcQuery } from '../../helpers/trpc-mock';

test.describe.configure({ timeout: 90_000 });

test.describe('Owner Settings — Interactions', () => {
  test('profile form save button is disabled when no changes made', async ({ page }) => {
    await mockTrpcQuery(page, 'owner.getProfile', ownerProfile);
    await mockTrpcQuery(page, 'owner.getPlans', ownerPlans);
    await mockAllTrpc(page);

    await gotoPortalPage(page, '/owner/settings');

    // Wait for the profile form to load with pre-filled data
    const nameInput = page.locator('#name');
    await expect(nameInput).toBeVisible({ timeout: 5000 });
    await expect(nameInput).toHaveValue('Jane Doe');

    // Save button should be disabled because no changes have been made
    const saveBtn = page.getByRole('button', { name: /save changes/i });
    await expect(saveBtn).toBeVisible();
    await expect(saveBtn).toBeDisabled();
  });

  test('editing name enables save button and submitting shows success message', async ({
    page,
  }) => {
    await mockTrpcQuery(page, 'owner.getProfile', ownerProfile);
    await mockTrpcQuery(page, 'owner.getPlans', ownerPlans);
    await mockTrpcMutation(page, 'owner.updateProfile', { success: true });
    await mockAllTrpc(page);

    await gotoPortalPage(page, '/owner/settings');

    // Wait for profile form to load
    const nameInput = page.locator('#name');
    await expect(nameInput).toBeVisible({ timeout: 5000 });
    await expect(nameInput).toHaveValue('Jane Doe');

    // Save button starts disabled
    const saveBtn = page.getByRole('button', { name: /save changes/i });
    await expect(saveBtn).toBeDisabled();

    // Edit the name field
    await nameInput.clear();
    await nameInput.fill('Jane Updated');

    // Save button should now be enabled
    await expect(saveBtn).toBeEnabled();

    // Click save
    await saveBtn.click();

    // Success message should appear
    await expect(page.getByText('Profile updated successfully.')).toBeVisible({ timeout: 5000 });
  });

  test('profile update failure shows error message', async ({ page }) => {
    await mockTrpcQuery(page, 'owner.getProfile', ownerProfile);
    await mockTrpcQuery(page, 'owner.getPlans', ownerPlans);
    await mockTrpcMutationError(
      page,
      'owner.updateProfile',
      'INTERNAL_SERVER_ERROR',
      'Failed to update',
    );
    await mockAllTrpc(page);

    await gotoPortalPage(page, '/owner/settings');

    // Wait for profile form to load
    const nameInput = page.locator('#name');
    await expect(nameInput).toBeVisible({ timeout: 5000 });
    await expect(nameInput).toHaveValue('Jane Doe');

    // Make a change to enable the save button
    await nameInput.clear();
    await nameInput.fill('Jane Fail');

    // Submit the form
    const saveBtn = page.getByRole('button', { name: /save changes/i });
    await expect(saveBtn).toBeEnabled();
    await saveBtn.click();

    // Error message should appear
    await expect(page.getByText('Failed to update profile. Please try again.')).toBeVisible({
      timeout: 5000,
    });
  });
});
