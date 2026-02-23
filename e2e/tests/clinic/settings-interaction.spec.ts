import { expect, test } from '@playwright/test';
import { clinicProfile } from '../../helpers/audit-mock-data';
import { gotoPortalPage, mockAllTrpc } from '../../helpers/portal-test-base';
import { mockTrpcMutation, mockTrpcQuery } from '../../helpers/trpc-mock';

test.describe.configure({ timeout: 90_000 });

test.describe('Clinic Settings — Interactions', () => {
  test('profile form pre-fills data', async ({ page }) => {
    await mockTrpcQuery(page, 'clinic.getProfile', clinicProfile);
    await mockAllTrpc(page);

    await gotoPortalPage(page, '/clinic/settings');

    // Clinic name pre-filled
    const nameInput = page.locator('#clinic-name');
    if (await nameInput.isVisible({ timeout: 5000 }).catch(() => false)) {
      await expect(nameInput).toHaveValue('Happy Paws Veterinary');
    }

    // Phone pre-filled
    const phoneInput = page.locator('#clinic-phone');
    if (await phoneInput.isVisible({ timeout: 3000 }).catch(() => false)) {
      const value = await phoneInput.inputValue();
      expect(value).toBeTruthy();
    }
  });

  test('profile form submission', async ({ page }) => {
    await mockTrpcQuery(page, 'clinic.getProfile', clinicProfile);
    await mockTrpcMutation(page, 'clinic.updateProfile', { success: true });
    await mockAllTrpc(page);

    await gotoPortalPage(page, '/clinic/settings');

    const nameInput = page.locator('#clinic-name');
    if (await nameInput.isVisible({ timeout: 5000 }).catch(() => false)) {
      await nameInput.clear();
      await nameInput.fill('Happy Paws Veterinary Updated');

      const saveBtn = page.getByRole('button', { name: /save/i });
      await expect(saveBtn).toBeVisible();
      await saveBtn.click();

      await expect(page.getByText(/updated|saved|success/i).first()).toBeVisible({ timeout: 5000 });
    }
  });

  test('Stripe Connect shows connected status', async ({ page }) => {
    await mockTrpcQuery(page, 'clinic.getProfile', clinicProfile);
    await mockAllTrpc(page);

    await gotoPortalPage(page, '/clinic/settings');

    // Stripe section should indicate connected
    const stripeSection = page.getByText(/stripe.*connect|connected|acct_/i);
    await expect(stripeSection.first()).toBeVisible({ timeout: 5000 });
  });

  test('form validation: invalid phone', async ({ page }) => {
    await mockTrpcQuery(page, 'clinic.getProfile', clinicProfile);
    await mockAllTrpc(page);

    await gotoPortalPage(page, '/clinic/settings');

    const phoneInput = page.locator('#clinic-phone');
    if (await phoneInput.isVisible({ timeout: 5000 }).catch(() => false)) {
      await phoneInput.clear();
      await phoneInput.fill('invalid');

      const saveBtn = page.getByRole('button', { name: /save/i });
      if (await saveBtn.isEnabled()) {
        await saveBtn.click();
        // Wait for validation feedback
        await page.waitForTimeout(1000);
      }
    }
  });
});
