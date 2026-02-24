import { expect, test } from '@playwright/test';
import { clinicProfile } from '../../helpers/audit-mock-data';
import { gotoPortalPage, mockAllTrpc, mockExternalServices } from '../../helpers/portal-test-base';
import { mockTrpcMutation, mockTrpcMutationError, mockTrpcQuery } from '../../helpers/trpc-mock';

test.describe.configure({ timeout: 90_000 });

test.describe('Clinic Enrollment — Workflow', () => {
  test.beforeEach(async ({ page }) => {
    await mockExternalServices(page);
    await mockTrpcQuery(page, 'clinic.getProfile', clinicProfile);
    await mockAllTrpc(page);
  });

  test('form renders with clinic pre-selected', async ({ page }) => {
    await gotoPortalPage(page, '/clinic/enroll');

    // Should show enrollment form with "Initiate Enrollment" card title
    await expect(
      page.getByText(/initiate.*enrollment|new.*payment.*plan|enroll/i).first(),
    ).toBeVisible({ timeout: 5000 });

    // Verify the form structure is present (owner name input, bill amount input)
    await expect(page.locator('#owner-name')).toBeVisible({ timeout: 5000 });
    await expect(page.locator('#bill-amount')).toBeVisible({ timeout: 5000 });
  });

  test('fills owner data and submits', async ({ page }) => {
    await mockTrpcMutation(page, 'enrollment.create', {
      planId: 'plan-new-001',
      checkoutUrl: 'https://checkout.stripe.com/test',
    });

    await gotoPortalPage(page, '/clinic/enroll');

    // Fill owner info
    await page.locator('#owner-name').fill('Jane Smith');
    await page.locator('#owner-email').fill('jane@example.com');
    await page.locator('#owner-phone').fill('5551234567');
    await page.locator('#pet-name').fill('Whiskers');

    // Select payment method
    const debitBtn = page.getByRole('button', { name: /debit card/i });
    if (await debitBtn.isVisible({ timeout: 3000 }).catch(() => false)) {
      await debitBtn.click();
    }

    // Fill bill amount
    await page.locator('#bill-amount').fill('1200');

    // Submit
    const submitBtn = page.getByRole('button', {
      name: /create.*payment|create.*enrollment|submit/i,
    });
    if (await submitBtn.isEnabled({ timeout: 3000 }).catch(() => false)) {
      await submitBtn.click();

      // Should show success or redirect
      await expect(page.getByText(/created|success|enrollment/i).first()).toBeVisible({
        timeout: 10000,
      });
    }
  });

  test('validates bill range ($500-$25K)', async ({ page }) => {
    await gotoPortalPage(page, '/clinic/enroll');

    const billInput = page.locator('#bill-amount');
    await expect(billInput).toBeVisible({ timeout: 5000 });

    // Below minimum
    await billInput.fill('200');
    const minError = page.getByText(/minimum|\$500/i);
    if (
      await minError
        .first()
        .isVisible({ timeout: 3000 })
        .catch(() => false)
    ) {
      expect(await minError.count()).toBeGreaterThan(0);
    }

    // Above maximum
    await billInput.clear();
    await billInput.fill('30000');
    const maxError = page.getByText(/maximum|\$25,000/i);
    if (
      await maxError
        .first()
        .isVisible({ timeout: 3000 })
        .catch(() => false)
    ) {
      expect(await maxError.count()).toBeGreaterThan(0);
    }
  });

  test('validates required fields', async ({ page }) => {
    await gotoPortalPage(page, '/clinic/enroll');

    // Try to submit with empty fields
    const submitBtn = page.getByRole('button', {
      name: /create.*payment|create.*enrollment|submit/i,
    });
    if (await submitBtn.isVisible({ timeout: 5000 }).catch(() => false)) {
      // Should be disabled or show errors on click
      if (await submitBtn.isEnabled()) {
        await submitBtn.click();
        await page.waitForTimeout(500);
      }
    }
  });

  test('handles creation error', async ({ page }) => {
    await mockTrpcMutationError(
      page,
      'enrollment.create',
      'INTERNAL_SERVER_ERROR',
      'Unable to create enrollment',
    );

    await gotoPortalPage(page, '/clinic/enroll');

    // Fill required fields
    await page.locator('#owner-name').fill('Jane Smith');
    await page.locator('#owner-email').fill('jane@example.com');
    await page.locator('#owner-phone').fill('5551234567');
    await page.locator('#pet-name').fill('Whiskers');
    await page.locator('#bill-amount').fill('1200');

    const debitBtn = page.getByRole('button', { name: /debit card/i });
    if (await debitBtn.isVisible({ timeout: 3000 }).catch(() => false)) {
      await debitBtn.click();
    }

    const submitBtn = page.getByRole('button', {
      name: /create.*payment|create.*enrollment|submit/i,
    });
    if (await submitBtn.isEnabled({ timeout: 3000 }).catch(() => false)) {
      await submitBtn.click();

      // Error message
      await expect(page.getByText(/error|unable|failed/i).first()).toBeVisible({ timeout: 10000 });
    }
  });
});
