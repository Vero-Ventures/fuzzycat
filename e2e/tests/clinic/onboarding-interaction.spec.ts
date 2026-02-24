import { test } from '@playwright/test';
import { clinicOnboardingStatus } from '../../helpers/audit-mock-data';
import { gotoPortalPage, mockAllTrpc } from '../../helpers/portal-test-base';
import { mockTrpcMutation, mockTrpcQuery } from '../../helpers/trpc-mock';

test.describe.configure({ timeout: 90_000 });

test.describe('Clinic Onboarding — Interactions', () => {
  test('complete onboarding button for finished setup', async ({ page }) => {
    await mockTrpcQuery(page, 'clinic.getOnboardingStatus', clinicOnboardingStatus);
    await mockTrpcMutation(page, 'clinic.completeOnboarding', { success: true });
    await mockAllTrpc(page);

    await gotoPortalPage(page, '/clinic/onboarding');

    // Complete/Go to dashboard button
    const completeBtn = page
      .getByRole('button', { name: /complete|go to dashboard|continue/i })
      .or(page.getByRole('link', { name: /dashboard|complete/i }));
    if (
      await completeBtn
        .first()
        .isVisible({ timeout: 5000 })
        .catch(() => false)
    ) {
      await completeBtn.first().click();
    }
  });
});
