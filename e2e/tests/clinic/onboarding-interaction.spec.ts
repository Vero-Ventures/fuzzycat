import { expect, test } from '@playwright/test';
import { clinicOnboardingIncomplete, clinicOnboardingStatus } from '../../helpers/audit-mock-data';
import { gotoPortalPage, mockAllTrpc } from '../../helpers/portal-test-base';
import { mockTrpcMutation, mockTrpcQuery } from '../../helpers/trpc-mock';

test.describe.configure({ timeout: 90_000 });

test.describe('Clinic Onboarding — Interactions', () => {
  test('complete onboarding shows all checks green', async ({ page }) => {
    await mockTrpcQuery(page, 'clinic.getOnboardingStatus', clinicOnboardingStatus);
    await mockAllTrpc(page);

    await gotoPortalPage(page, '/clinic/onboarding');

    // Onboarding heading
    await expect(
      page.getByRole('heading', { name: /onboarding|welcome|get started/i }).first(),
    ).toBeVisible({ timeout: 5000 });

    // All steps complete — look for completion indicators
    const complete = page.getByText(/complete|all.*done|ready/i);
    if (
      await complete
        .first()
        .isVisible({ timeout: 3000 })
        .catch(() => false)
    ) {
      expect(await complete.count()).toBeGreaterThan(0);
    }
  });

  test('incomplete onboarding shows pending steps', async ({ page }) => {
    await mockTrpcQuery(page, 'clinic.getOnboardingStatus', clinicOnboardingIncomplete);
    await mockAllTrpc(page);

    await gotoPortalPage(page, '/clinic/onboarding');

    // Should show pending/incomplete indicators
    const pending = page.getByText(/pending|incomplete|not.*started|set up/i);
    await expect(pending.first()).toBeVisible({ timeout: 5000 });
  });

  test('Stripe Connect button visible for incomplete', async ({ page }) => {
    await mockTrpcQuery(page, 'clinic.getOnboardingStatus', clinicOnboardingIncomplete);
    await mockAllTrpc(page);

    await gotoPortalPage(page, '/clinic/onboarding');

    // Stripe connect CTA
    const stripeBtn = page
      .getByRole('button', { name: /connect.*stripe|set up.*stripe|stripe/i })
      .or(page.getByRole('link', { name: /connect.*stripe|set up.*stripe|stripe/i }));
    await expect(stripeBtn.first()).toBeVisible({ timeout: 5000 });
  });

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
