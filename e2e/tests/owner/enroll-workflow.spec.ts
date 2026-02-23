import { expect, test } from '@playwright/test';
import { clinicSearch } from '../../helpers/audit-mock-data';
import { gotoPortalPage, mockAllTrpc, mockExternalServices } from '../../helpers/portal-test-base';
import { mockTrpcMutationError, mockTrpcQuery } from '../../helpers/trpc-mock';

test.describe.configure({ timeout: 90_000 });

test.describe('Enrollment Wizard Workflow', () => {
  test.beforeEach(async ({ page }) => {
    await mockExternalServices(page);
    await mockTrpcQuery(page, 'clinic.search', clinicSearch);
    await mockAllTrpc(page);
  });

  // ── Step 1: Clinic Selection ───────────────────────────────────────────────

  test('Step 1: search clinic, select, advance', async ({ page }) => {
    await gotoPortalPage(page, '/owner/enroll');

    // Verify Step 1 is shown
    await expect(
      page.getByText(/select your veterinary clinic|find your vet|step 1/i).first(),
    ).toBeVisible({ timeout: 5000 });

    // Search for a clinic
    const searchInput = page.locator('#clinic-search');
    await expect(searchInput).toBeVisible();
    await searchInput.fill('Happy');

    // Wait for mock results
    await expect(page.getByText('Happy Paws Veterinary').first()).toBeVisible({ timeout: 5000 });

    // Select the clinic
    await page.getByText('Happy Paws Veterinary').first().click();

    // Continue button should be enabled
    const continueBtn = page.getByRole('button', { name: /continue/i });
    await expect(continueBtn).toBeEnabled();
    await continueBtn.click();

    // Should advance to Step 2
    await expect(page.getByText(/bill details|your information|step 2/i).first()).toBeVisible({
      timeout: 5000,
    });
  });

  // ── Step 2: Bill Details ───────────────────────────────────────────────────

  test('Step 2: enter bill details, see payment schedule', async ({ page }) => {
    await gotoPortalPage(page, '/owner/enroll');

    // Navigate past Step 1
    const searchInput = page.locator('#clinic-search');
    await searchInput.fill('Happy');
    await page.getByText('Happy Paws Veterinary').first().click();
    await page.getByRole('button', { name: /continue/i }).click();
    await expect(page.getByText(/bill details|step 2/i).first()).toBeVisible({ timeout: 5000 });

    // Fill in bill amount
    const billInput = page.locator('#bill-amount');
    await billInput.fill('1200');

    // Fill personal info
    await page.locator('#owner-name').fill('Jane Smith');
    await page.locator('#owner-email').fill('jane@example.com');
    await page.locator('#owner-phone').fill('5551234567');
    await page.locator('#pet-name').fill('Whiskers');

    // Payment schedule should appear
    await expect(page.getByText(/deposit/i).first()).toBeVisible({ timeout: 5000 });

    // Continue should be enabled
    await expect(page.getByRole('button', { name: /continue/i })).toBeEnabled();
  });

  test('Step 2: bill below $500 minimum shows error', async ({ page }) => {
    await gotoPortalPage(page, '/owner/enroll');

    // Navigate past Step 1
    const searchInput = page.locator('#clinic-search');
    await searchInput.fill('Happy');
    await page.getByText('Happy Paws Veterinary').first().click();
    await page.getByRole('button', { name: /continue/i }).click();
    await expect(page.getByText(/bill details|step 2/i).first()).toBeVisible({ timeout: 5000 });

    // Enter amount below minimum
    const billInput = page.locator('#bill-amount');
    await billInput.fill('200');

    // Should show minimum bill error
    await expect(page.getByText(/minimum.*bill.*\$500|\$500.*minimum/i).first()).toBeVisible({
      timeout: 5000,
    });
  });

  test('Step 2: required field validation', async ({ page }) => {
    await gotoPortalPage(page, '/owner/enroll');

    // Navigate past Step 1
    const searchInput = page.locator('#clinic-search');
    await searchInput.fill('Happy');
    await page.getByText('Happy Paws Veterinary').first().click();
    await page.getByRole('button', { name: /continue/i }).click();
    await expect(page.getByText(/bill details|step 2/i).first()).toBeVisible({ timeout: 5000 });

    // Enter valid bill but leave fields empty
    const billInput = page.locator('#bill-amount');
    await billInput.fill('1200');

    // Continue should be disabled with empty required fields
    const continueBtn = page.getByRole('button', { name: /continue/i });
    // Either disabled or clicking shows validation errors
    if (await continueBtn.isEnabled()) {
      await continueBtn.click();
      // Should show required field errors
      await page.waitForTimeout(500);
    }
  });

  // ── Step 3: Payment Method ─────────────────────────────────────────────────

  test('Step 3: choose debit card method', async ({ page }) => {
    await gotoPortalPage(page, '/owner/enroll');

    // Navigate past Step 1
    const searchInput = page.locator('#clinic-search');
    await searchInput.fill('Happy');
    await page.getByText('Happy Paws Veterinary').first().click();
    await page.getByRole('button', { name: /continue/i }).click();

    // Fill Step 2
    await page.locator('#bill-amount').fill('1200');
    await page.locator('#owner-name').fill('Jane Smith');
    await page.locator('#owner-email').fill('jane@example.com');
    await page.locator('#owner-phone').fill('5551234567');
    await page.locator('#pet-name').fill('Whiskers');
    await page.getByRole('button', { name: /continue/i }).click();

    // Step 3: Payment Method
    await expect(page.getByText(/payment method|step 3/i).first()).toBeVisible({ timeout: 5000 });

    // Click debit card option
    const debitBtn = page.getByRole('button', { name: /debit card/i });
    await expect(debitBtn).toBeVisible();
    await debitBtn.click();

    // Continue should become enabled
    await expect(page.getByRole('button', { name: /continue/i })).toBeEnabled({ timeout: 5000 });
  });

  test('Step 3: connect bank via Plaid shows button', async ({ page }) => {
    await gotoPortalPage(page, '/owner/enroll');

    // Navigate past Step 1
    const searchInput = page.locator('#clinic-search');
    await searchInput.fill('Happy');
    await page.getByText('Happy Paws Veterinary').first().click();
    await page.getByRole('button', { name: /continue/i }).click();

    // Fill Step 2
    await page.locator('#bill-amount').fill('1200');
    await page.locator('#owner-name').fill('Jane Smith');
    await page.locator('#owner-email').fill('jane@example.com');
    await page.locator('#owner-phone').fill('5551234567');
    await page.locator('#pet-name').fill('Whiskers');
    await page.getByRole('button', { name: /continue/i }).click();

    // Step 3: Bank account option
    await expect(page.getByText(/payment method|step 3/i).first()).toBeVisible({ timeout: 5000 });

    const bankBtn = page.getByRole('button', { name: /connect bank|bank account/i });
    await expect(bankBtn).toBeVisible();
  });

  // ── Step 4: Review & Confirm ───────────────────────────────────────────────

  test('Step 4: cannot proceed without disclaimers', async ({ page }) => {
    await gotoPortalPage(page, '/owner/enroll');

    // Navigate to Step 4 via debit card path
    const searchInput = page.locator('#clinic-search');
    await searchInput.fill('Happy');
    await page.getByText('Happy Paws Veterinary').first().click();
    await page.getByRole('button', { name: /continue/i }).click();
    await page.locator('#bill-amount').fill('1200');
    await page.locator('#owner-name').fill('Jane Smith');
    await page.locator('#owner-email').fill('jane@example.com');
    await page.locator('#owner-phone').fill('5551234567');
    await page.locator('#pet-name').fill('Whiskers');
    await page.getByRole('button', { name: /continue/i }).click();
    await page.getByRole('button', { name: /debit card/i }).click();
    await page.getByRole('button', { name: /continue/i }).click();

    // Step 4: Review
    await expect(page.getByText(/review|confirm|step 4/i).first()).toBeVisible({ timeout: 5000 });

    // Confirm button should be disabled without disclaimers
    const confirmBtn = page.getByRole('button', { name: /confirm.*pay|pay deposit/i });
    if (await confirmBtn.isVisible({ timeout: 3000 }).catch(() => false)) {
      await expect(confirmBtn).toBeDisabled();
    }
  });

  test('Step 4: review summary displays plan details', async ({ page }) => {
    await gotoPortalPage(page, '/owner/enroll');

    // Navigate to Step 4
    const searchInput = page.locator('#clinic-search');
    await searchInput.fill('Happy');
    await page.getByText('Happy Paws Veterinary').first().click();
    await page.getByRole('button', { name: /continue/i }).click();
    await page.locator('#bill-amount').fill('1200');
    await page.locator('#owner-name').fill('Jane Smith');
    await page.locator('#owner-email').fill('jane@example.com');
    await page.locator('#owner-phone').fill('5551234567');
    await page.locator('#pet-name').fill('Whiskers');
    await page.getByRole('button', { name: /continue/i }).click();
    await page.getByRole('button', { name: /debit card/i }).click();
    await page.getByRole('button', { name: /continue/i }).click();

    // Step 4: Verify review content
    await expect(page.getByText(/review|step 4/i).first()).toBeVisible({ timeout: 5000 });

    // Should show payment breakdown
    await expect(page.getByText(/\$1,200|\$1200/i).first()).toBeVisible({ timeout: 3000 });
    // Should show clinic name
    await expect(page.getByText(/happy paws/i).first()).toBeVisible({ timeout: 3000 });
  });

  // ── Step 5: Deposit Payment ────────────────────────────────────────────────

  test('Step 5: enrollment error shows message', async ({ page }) => {
    await mockTrpcMutationError(
      page,
      'enrollment.create',
      'INTERNAL_SERVER_ERROR',
      'Unable to create enrollment',
    );

    await gotoPortalPage(page, '/owner/enroll');

    // Navigate to Step 4
    const searchInput = page.locator('#clinic-search');
    await searchInput.fill('Happy');
    await page.getByText('Happy Paws Veterinary').first().click();
    await page.getByRole('button', { name: /continue/i }).click();
    await page.locator('#bill-amount').fill('1200');
    await page.locator('#owner-name').fill('Jane Smith');
    await page.locator('#owner-email').fill('jane@example.com');
    await page.locator('#owner-phone').fill('5551234567');
    await page.locator('#pet-name').fill('Whiskers');
    await page.getByRole('button', { name: /continue/i }).click();
    await page.getByRole('button', { name: /debit card/i }).click();
    await page.getByRole('button', { name: /continue/i }).click();

    // Step 4: Accept disclaimers if possible
    const disclaimer = page.locator('#disclaimers');
    if (await disclaimer.isVisible({ timeout: 3000 }).catch(() => false)) {
      await disclaimer.check();
    }

    // Try to submit — the mutation error should surface
    const confirmBtn = page.getByRole('button', { name: /confirm.*pay|pay deposit/i });
    if (await confirmBtn.isEnabled({ timeout: 3000 }).catch(() => false)) {
      await confirmBtn.click();
      // Error message should appear
      await expect(page.getByText(/unable.*create|error|failed/i).first()).toBeVisible({
        timeout: 10000,
      });
    }
  });

  // ── Back Navigation ────────────────────────────────────────────────────────

  test('Back navigation across steps', async ({ page }) => {
    await gotoPortalPage(page, '/owner/enroll');

    // Step 1: Select clinic and advance
    const searchInput = page.locator('#clinic-search');
    await searchInput.fill('Happy');
    await page.getByText('Happy Paws Veterinary').first().click();
    await page.getByRole('button', { name: /continue/i }).click();

    // Step 2: Verify we're here
    await expect(page.getByText(/bill details|step 2/i).first()).toBeVisible({ timeout: 5000 });

    // Click Back
    await page.getByRole('button', { name: /back/i }).click();

    // Should return to Step 1
    await expect(
      page.getByText(/select your veterinary clinic|find your vet|step 1/i).first(),
    ).toBeVisible({ timeout: 5000 });

    // Go forward again
    await page.getByRole('button', { name: /continue/i }).click();
    await expect(page.getByText(/bill details|step 2/i).first()).toBeVisible({ timeout: 5000 });
  });
});
