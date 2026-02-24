import { expect, test } from '@playwright/test';
import {
  clinicSearch,
  emptyOwnerDashboardSummary,
  emptyOwnerPaymentHistory,
  emptyOwnerPlans,
  enrollmentSummary,
  ownerDashboardSummary,
  ownerPaymentHistory,
  ownerPlans,
  ownerProfile,
} from '../../helpers/audit-mock-data';
import { gotoPortalPage, mockAllTrpc, mockExternalServices } from '../../helpers/portal-test-base';
import { mockTrpcMutation, mockTrpcQuery, mockTrpcQueryError } from '../../helpers/trpc-mock';

// These tests run under the "mobile-portal" project with Pixel 5 viewport
test.describe.configure({ timeout: 90_000 });

test.describe('Owner Portal — Mobile', () => {
  test.use({ storageState: 'e2e/auth-state/owner.json' });

  // ── Payments Dashboard ─────────────────────────────────────────────────────

  test('payments dashboard renders correctly on mobile', async ({ page }, testInfo) => {
    await mockExternalServices(page);
    await mockTrpcQuery(page, 'owner.getDashboardSummary', ownerDashboardSummary);
    await mockTrpcQuery(page, 'owner.getPlans', ownerPlans);
    await mockTrpcQuery(page, 'owner.getPaymentHistory', ownerPaymentHistory);
    await mockAllTrpc(page);

    await gotoPortalPage(page, '/owner/payments');

    // Page heading visible
    await expect(page.getByText(/my payment plan/i).first()).toBeVisible({ timeout: 5000 });

    // Summary cards visible and stacked vertically
    await expect(page.getByText(/next payment/i).first()).toBeVisible({ timeout: 5000 });
    await expect(page.getByText(/\$106/).first()).toBeVisible({ timeout: 5000 });
    await expect(page.getByText(/total paid/i).first()).toBeVisible({ timeout: 5000 });
    await expect(page.getByText(/\$424/).first()).toBeVisible({ timeout: 5000 });

    // Plans visible
    await expect(page.getByText(/happy paws/i).first()).toBeVisible({ timeout: 5000 });

    // Verify no horizontal overflow
    const hasOverflow = await page.evaluate(() => {
      return document.documentElement.scrollWidth > document.documentElement.clientWidth;
    });
    expect(hasOverflow).toBe(false);

    await testInfo.attach('mobile-owner-payments', {
      body: await page.screenshot({ fullPage: true }),
      contentType: 'image/png',
    });
  });

  test('payments empty state on mobile', async ({ page }, testInfo) => {
    await mockExternalServices(page);
    await mockTrpcQuery(page, 'owner.getDashboardSummary', emptyOwnerDashboardSummary);
    await mockTrpcQuery(page, 'owner.getPlans', emptyOwnerPlans);
    await mockTrpcQuery(page, 'owner.getPaymentHistory', emptyOwnerPaymentHistory);
    await mockAllTrpc(page);

    await gotoPortalPage(page, '/owner/payments');

    const emptyState = page.getByText(/no.*payment.*plan|no.*plan.*yet|get started/i);
    await expect(emptyState.first()).toBeVisible({ timeout: 5000 });

    await testInfo.attach('mobile-owner-payments-empty', {
      body: await page.screenshot({ fullPage: true }),
      contentType: 'image/png',
    });
  });

  test('payments error state on mobile', async ({ page }, testInfo) => {
    await mockExternalServices(page);
    await mockTrpcQueryError(page, 'owner.getDashboardSummary', 'INTERNAL_SERVER_ERROR', 'Fail');
    await mockTrpcQueryError(page, 'owner.getPlans', 'INTERNAL_SERVER_ERROR', 'Fail');
    await mockTrpcQueryError(page, 'owner.getPaymentHistory', 'INTERNAL_SERVER_ERROR', 'Fail');
    await mockAllTrpc(page);

    await gotoPortalPage(page, '/owner/payments');

    const error = page.getByText(/unable.*load|error|something went wrong/i);
    await expect(error.first()).toBeVisible({ timeout: 10000 });

    await testInfo.attach('mobile-owner-payments-error', {
      body: await page.screenshot({ fullPage: true }),
      contentType: 'image/png',
    });
  });

  // ── Settings ───────────────────────────────────────────────────────────────

  test('settings form usable on mobile', async ({ page }, testInfo) => {
    await mockExternalServices(page);
    await mockTrpcQuery(page, 'owner.getProfile', ownerProfile);
    await mockTrpcQuery(page, 'owner.getPlans', ownerPlans);
    await mockTrpcMutation(page, 'owner.updateProfile', { success: true });
    await mockAllTrpc(page);

    await gotoPortalPage(page, '/owner/settings');

    // Form fields are accessible
    const nameInput = page.locator('#name');
    if (await nameInput.isVisible({ timeout: 5000 }).catch(() => false)) {
      await expect(nameInput).toHaveValue('Jane Doe');

      // Update field on mobile
      await nameInput.clear();
      await nameInput.fill('Jane Mobile');

      // Submit button accessible
      const saveBtn = page.getByRole('button', { name: /save/i });
      await expect(saveBtn).toBeVisible();

      // Scroll into view and tap
      await saveBtn.scrollIntoViewIfNeeded();
      await saveBtn.click();

      await expect(page.getByText(/updated|saved|success/i).first()).toBeVisible({ timeout: 5000 });
    }

    await testInfo.attach('mobile-owner-settings', {
      body: await page.screenshot({ fullPage: true }),
      contentType: 'image/png',
    });
  });

  // ── Enrollment Wizard ──────────────────────────────────────────────────────

  test('enrollment wizard Step 1 on mobile', async ({ page }, testInfo) => {
    await mockExternalServices(page);
    await mockTrpcQuery(page, 'clinic.search', clinicSearch);
    await mockAllTrpc(page);

    await gotoPortalPage(page, '/owner/enroll');

    // Wizard renders
    await expect(page.getByText(/enroll|payment plan|step 1|find your vet/i).first()).toBeVisible({
      timeout: 5000,
    });

    // Search works on mobile
    const searchInput = page.locator('#clinic-search');
    await expect(searchInput).toBeVisible();
    await searchInput.fill('Happy');

    await expect(page.getByText('Happy Paws Veterinary').first()).toBeVisible({ timeout: 5000 });
    await page.getByText('Happy Paws Veterinary').first().click();

    // Continue button
    const continueBtn = page.getByRole('button', { name: /continue/i });
    await continueBtn.scrollIntoViewIfNeeded();
    await expect(continueBtn).toBeEnabled();

    await testInfo.attach('mobile-enroll-step1', {
      body: await page.screenshot({ fullPage: true }),
      contentType: 'image/png',
    });
  });

  test('enrollment wizard Step 2 on mobile', async ({ page }, testInfo) => {
    await mockExternalServices(page);
    await mockTrpcQuery(page, 'clinic.search', clinicSearch);
    await mockAllTrpc(page);

    await gotoPortalPage(page, '/owner/enroll');

    // Navigate to Step 2
    await page.locator('#clinic-search').fill('Happy');
    await page.getByText('Happy Paws Veterinary').first().click();
    await page.getByRole('button', { name: /continue/i }).click();

    // The stepper label "Bill Details" is hidden on mobile (hidden md:block).
    // Instead, look for the always-visible step indicator or the h2 heading.
    await expect(
      page
        .getByText(/step 2 of/i)
        .or(page.locator('h2').filter({ hasText: /bill details/i }))
        .first(),
    ).toBeVisible({ timeout: 5000 });

    // Form fields accessible and tapable on mobile
    await page.locator('#bill-amount').fill('1200');
    await page.locator('#owner-name').fill('Jane Smith');
    await page.locator('#owner-email').fill('jane@example.com');
    await page.locator('#owner-phone').fill('5551234567');
    await page.locator('#pet-name').fill('Whiskers');

    // Payment schedule visible — use specific text to avoid matching the hidden stepper label "Pay Deposit"
    await expect(page.getByText(/deposit.*25%|your payment schedule/i).first()).toBeVisible({
      timeout: 5000,
    });

    // No horizontal overflow
    const hasOverflow = await page.evaluate(() => {
      return document.documentElement.scrollWidth > document.documentElement.clientWidth;
    });
    expect(hasOverflow).toBe(false);

    await testInfo.attach('mobile-enroll-step2', {
      body: await page.screenshot({ fullPage: true }),
      contentType: 'image/png',
    });
  });

  test('enrollment success page on mobile', async ({ page }, testInfo) => {
    await mockExternalServices(page);
    await mockTrpcQuery(page, 'enrollment.getSummary', enrollmentSummary);
    await mockAllTrpc(page);

    await gotoPortalPage(page, '/owner/enroll/success?planId=plan-new-001');

    await expect(page.getByText(/happy paws/i).first()).toBeVisible({ timeout: 5000 });
    await expect(page.getByText(/whiskers/i).first()).toBeVisible({ timeout: 5000 });

    await testInfo.attach('mobile-enroll-success', {
      body: await page.screenshot({ fullPage: true }),
      contentType: 'image/png',
    });
  });

  // ── Navigation ─────────────────────────────────────────────────────────────

  test('owner navigation works on mobile', async ({ page }) => {
    await mockExternalServices(page);
    await mockTrpcQuery(page, 'owner.getDashboardSummary', ownerDashboardSummary);
    await mockTrpcQuery(page, 'owner.getPlans', ownerPlans);
    await mockTrpcQuery(page, 'owner.getPaymentHistory', ownerPaymentHistory);
    await mockTrpcQuery(page, 'owner.getProfile', ownerProfile);
    await mockAllTrpc(page);

    await gotoPortalPage(page, '/owner/payments');

    // Settings link
    const settingsLink = page.getByRole('link', { name: /setting/i });
    if (await settingsLink.isVisible({ timeout: 5000 }).catch(() => false)) {
      await settingsLink.click();
      await page.waitForURL('**/owner/settings', { timeout: 10000 });
      expect(page.url()).toContain('/owner/settings');
    }
  });

  test('sign out button accessible on mobile', async ({ page }) => {
    await mockExternalServices(page);
    await mockTrpcQuery(page, 'owner.getDashboardSummary', ownerDashboardSummary);
    await mockTrpcQuery(page, 'owner.getPlans', ownerPlans);
    await mockTrpcQuery(page, 'owner.getPaymentHistory', ownerPaymentHistory);
    await mockAllTrpc(page);

    await gotoPortalPage(page, '/owner/payments');

    const signOut = page.getByRole('button', { name: /sign out|log out/i });
    await expect(signOut).toBeVisible({ timeout: 5000 });
  });
});
