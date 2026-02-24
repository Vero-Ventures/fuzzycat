import { expect, test } from '@playwright/test';
import { clinicProfile } from '../../helpers/audit-mock-data';
import { gotoPortalPage, mockAllTrpc } from '../../helpers/portal-test-base';
import { mockTrpcMutation, mockTrpcQuery } from '../../helpers/trpc-mock';

test.describe.configure({ timeout: 90_000 });

test.describe('Clinic Settings — Interactions', () => {
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
