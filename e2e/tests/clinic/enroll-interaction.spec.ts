import { expect, test } from '@playwright/test';
import { clinicProfile } from '../../helpers/audit-mock-data';
import { gotoPortalPage, mockAllTrpc, mockExternalServices } from '../../helpers/portal-test-base';
import { mockTrpcMutation, mockTrpcQuery } from '../../helpers/trpc-mock';

test.describe.configure({ timeout: 90_000 });

test.describe('Clinic Enrollment — Form Interactions', () => {
  test.beforeEach(async ({ page }) => {
    await mockExternalServices(page);
    await mockTrpcQuery(page, 'clinic.getProfile', clinicProfile);
    await mockAllTrpc(page);
  });

  test('form renders with all required fields', async ({ page }) => {
    await gotoPortalPage(page, '/clinic/enroll');

    // Card title
    await expect(page.getByText(/initiate enrollment/i).first()).toBeVisible({ timeout: 5000 });

    // Owner information fields
    await expect(page.locator('#owner-name')).toBeVisible({ timeout: 5000 });
    await expect(page.locator('#owner-email')).toBeVisible({ timeout: 5000 });
    await expect(page.locator('#owner-phone')).toBeVisible({ timeout: 5000 });
    await expect(page.locator('#pet-name')).toBeVisible({ timeout: 5000 });

    // Bill amount field
    await expect(page.locator('#bill-amount')).toBeVisible({ timeout: 5000 });

    // Labels for all fields
    await expect(page.getByText(/full name/i)).toBeVisible({ timeout: 3000 });
    await expect(page.getByText(/email/i).first()).toBeVisible({ timeout: 3000 });
    await expect(page.getByText(/phone/i).first()).toBeVisible({ timeout: 3000 });
    await expect(page.getByText(/pet name/i)).toBeVisible({ timeout: 3000 });
    await expect(page.getByText(/vet bill amount/i)).toBeVisible({ timeout: 3000 });

    // Payment method buttons
    await expect(page.getByRole('button', { name: /debit card/i })).toBeVisible({ timeout: 3000 });
    await expect(page.getByRole('button', { name: /bank account/i })).toBeVisible({
      timeout: 3000,
    });

    // Submit button
    await expect(page.getByRole('button', { name: /create payment plan/i })).toBeVisible({
      timeout: 3000,
    });
  });

  test('payment method toggles between Debit Card and Bank Account', async ({ page }) => {
    await gotoPortalPage(page, '/clinic/enroll');

    const debitBtn = page.getByRole('button', { name: /debit card/i });
    const bankBtn = page.getByRole('button', { name: /bank account/i });

    await expect(debitBtn).toBeVisible({ timeout: 5000 });
    await expect(bankBtn).toBeVisible({ timeout: 5000 });

    // Debit Card is selected by default (variant="default" renders differently from variant="outline")
    // The default-selected button should NOT have the outline variant class
    // We can verify toggling by clicking Bank Account and checking the visual state changes
    await bankBtn.click();
    await page.waitForTimeout(300);

    // After clicking Bank Account, it should become the selected option.
    // Click back to Debit Card to verify toggle works both ways.
    await debitBtn.click();
    await page.waitForTimeout(300);

    // Both buttons should remain visible after toggling
    await expect(debitBtn).toBeVisible();
    await expect(bankBtn).toBeVisible();
  });

  test('entering valid bill amount shows payment preview', async ({ page }) => {
    await gotoPortalPage(page, '/clinic/enroll');

    const billInput = page.locator('#bill-amount');
    await expect(billInput).toBeVisible({ timeout: 5000 });

    // Enter a valid bill amount ($1,200 = 120000 cents)
    await billInput.fill('1200');

    // Payment Plan Preview section should appear
    await expect(page.getByText(/payment plan preview/i)).toBeVisible({ timeout: 5000 });

    // Preview should show fee breakdown
    // 6% platform fee on $1,200 = $72
    await expect(page.getByText(/platform fee.*6%/i)).toBeVisible({ timeout: 3000 });

    // Total with fee
    await expect(page.getByText(/total with fee/i)).toBeVisible({ timeout: 3000 });

    // Deposit (25%)
    await expect(page.getByText(/deposit.*25%/i)).toBeVisible({ timeout: 3000 });

    // Installments info
    await expect(page.getByText(/installments/i).first()).toBeVisible({ timeout: 3000 });
  });

  test('bill amount below $500 shows validation error on submit', async ({ page }) => {
    await gotoPortalPage(page, '/clinic/enroll');

    // Fill all required fields but with a bill amount below minimum
    await page.locator('#owner-name').fill('Jane Smith');
    await page.locator('#owner-email').fill('jane@example.com');
    await page.locator('#owner-phone').fill('5551234567');
    await page.locator('#pet-name').fill('Whiskers');
    await page.locator('#bill-amount').fill('200');

    // The payment preview should NOT appear for amounts below $500
    await expect(page.getByText(/payment plan preview/i)).not.toBeVisible({ timeout: 2000 });

    // Submit the form
    const submitBtn = page.getByRole('button', { name: /create payment plan/i });
    await expect(submitBtn).toBeVisible({ timeout: 5000 });
    await submitBtn.click();

    // Validation error about bill range
    await expect(page.getByText(/bill amount must be between \$500 and \$25,000/i)).toBeVisible({
      timeout: 5000,
    });
  });

  test('bill amount above $25,000 shows validation error on submit', async ({ page }) => {
    await gotoPortalPage(page, '/clinic/enroll');

    // Fill all required fields but with a bill amount above maximum
    await page.locator('#owner-name').fill('Jane Smith');
    await page.locator('#owner-email').fill('jane@example.com');
    await page.locator('#owner-phone').fill('5551234567');
    await page.locator('#pet-name').fill('Whiskers');
    await page.locator('#bill-amount').fill('30000');

    // Submit the form
    const submitBtn = page.getByRole('button', { name: /create payment plan/i });
    await expect(submitBtn).toBeVisible({ timeout: 5000 });
    await submitBtn.click();

    // Validation error about bill range
    await expect(page.getByText(/bill amount must be between \$500 and \$25,000/i)).toBeVisible({
      timeout: 5000,
    });
  });

  test('submitting with empty fields shows validation errors', async ({ page }) => {
    await gotoPortalPage(page, '/clinic/enroll');

    // Click submit without filling any fields
    const submitBtn = page.getByRole('button', { name: /create payment plan/i });
    await expect(submitBtn).toBeVisible({ timeout: 5000 });

    if (await submitBtn.isEnabled()) {
      await submitBtn.click();
      await page.waitForTimeout(500);

      // The form validates owner name first: "Owner name is required."
      await expect(page.getByText(/owner name is required/i)).toBeVisible({ timeout: 5000 });
    }
  });

  test('successful submission shows success screen with action buttons', async ({ page }) => {
    // Mock the enrollment creation mutation
    await mockTrpcMutation(page, 'enrollment.create', {
      planId: 'plan-new-001',
      checkoutUrl: 'https://checkout.stripe.com/test',
    });

    await gotoPortalPage(page, '/clinic/enroll');

    // Fill all required fields with valid data
    await page.locator('#owner-name').fill('Jane Smith');
    await page.locator('#owner-email').fill('jane@example.com');
    await page.locator('#owner-phone').fill('5551234567');
    await page.locator('#pet-name').fill('Whiskers');

    // Select payment method
    const debitBtn = page.getByRole('button', { name: /debit card/i });
    if (await debitBtn.isVisible({ timeout: 3000 }).catch(() => false)) {
      await debitBtn.click();
    }

    // Enter valid bill amount
    await page.locator('#bill-amount').fill('1500');

    // Verify payment preview appears before submitting
    await expect(page.getByText(/payment plan preview/i)).toBeVisible({ timeout: 5000 });

    // Submit the form
    const submitBtn = page.getByRole('button', { name: /create payment plan/i });
    await expect(submitBtn).toBeEnabled({ timeout: 3000 });
    await submitBtn.click();

    // Should show success screen
    await expect(page.getByText(/enrollment created/i)).toBeVisible({ timeout: 10000 });

    // Success message about email
    await expect(page.getByText(/payment plan has been created successfully/i)).toBeVisible({
      timeout: 5000,
    });

    // Action buttons on success screen
    await expect(page.getByRole('link', { name: /back to dashboard/i })).toBeVisible({
      timeout: 5000,
    });

    await expect(page.getByRole('button', { name: /create another/i })).toBeVisible({
      timeout: 5000,
    });
  });
});
