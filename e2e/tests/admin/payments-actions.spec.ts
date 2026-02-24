import { expect, test } from '@playwright/test';
import { adminPayments } from '../../helpers/audit-mock-data';
import { gotoPortalPage, mockAllTrpc } from '../../helpers/portal-test-base';
import { mockTrpcMutation, mockTrpcQuery } from '../../helpers/trpc-mock';

test.describe.configure({ timeout: 90_000 });

test.describe('Admin Payments — Actions', () => {
  test.beforeEach(async ({ page }) => {
    await mockTrpcQuery(page, 'admin.getPayments', adminPayments);
    await mockAllTrpc(page);
  });

  test('failed payment shows Retry button', async ({ page }) => {
    await gotoPortalPage(page, '/admin/payments');

    // The failed payment row (Bob Williams) should have a Retry button
    const retryBtn = page.getByRole('button', { name: /retry/i });
    await expect(retryBtn.first()).toBeVisible({ timeout: 5000 });
  });

  test('succeeded payments do not show Retry button', async ({ page }) => {
    await gotoPortalPage(page, '/admin/payments');

    // Wait for the table to render
    const table = page.locator('table').or(page.locator('[role="table"]'));
    await expect(table.first()).toBeVisible({ timeout: 5000 });

    // There is 1 failed payment in mock data, so exactly 1 Retry button
    const retryBtn = page.getByRole('button', { name: /retry/i });
    await expect(retryBtn).toHaveCount(1);
  });

  test('clicking Retry button triggers admin.retryPayment mutation', async ({ page }) => {
    await mockTrpcMutation(page, 'admin.retryPayment', { success: true });

    let mutationCalled = false;
    page.on('request', (req) => {
      if (req.method() === 'POST' && req.url().includes('admin.retryPayment')) {
        mutationCalled = true;
      }
    });

    await gotoPortalPage(page, '/admin/payments');

    const retryBtn = page.getByRole('button', { name: /retry/i });
    await expect(retryBtn.first()).toBeVisible({ timeout: 5000 });
    await retryBtn.first().click();

    // Allow time for the mutation request to fire
    await page.waitForTimeout(1000);
    expect(mutationCalled).toBe(true);
  });

  test('status tabs filter payments (All, Pending, Succeeded, Failed, Written Off)', async ({
    page,
  }) => {
    await gotoPortalPage(page, '/admin/payments');

    // All tabs should be visible
    await expect(page.getByRole('tab', { name: 'All' })).toBeVisible({ timeout: 5000 });
    await expect(page.getByRole('tab', { name: 'Pending' })).toBeVisible();
    await expect(page.getByRole('tab', { name: 'Succeeded' })).toBeVisible();
    await expect(page.getByRole('tab', { name: 'Failed' })).toBeVisible();
    await expect(page.getByRole('tab', { name: 'Written Off' })).toBeVisible();

    // "All" should be selected by default
    await expect(page.getByRole('tab', { name: 'All' })).toHaveAttribute('aria-selected', 'true');

    // Click the "Failed" tab and verify it becomes selected
    await page.getByRole('tab', { name: 'Failed' }).click();
    await expect(page.getByRole('tab', { name: 'Failed' })).toHaveAttribute(
      'aria-selected',
      'true',
    );

    // Click the "Succeeded" tab and verify it becomes selected
    await page.getByRole('tab', { name: 'Succeeded' }).click();
    await expect(page.getByRole('tab', { name: 'Succeeded' })).toHaveAttribute(
      'aria-selected',
      'true',
    );
  });

  test('date range inputs are visible and functional', async ({ page }) => {
    await gotoPortalPage(page, '/admin/payments');

    // Two date inputs should exist (From and To)
    const dateInputs = page.locator('input[type="date"]');
    await expect(dateInputs.first()).toBeVisible({ timeout: 5000 });
    await expect(dateInputs.nth(1)).toBeVisible();

    // Set a date value and verify it sticks
    await dateInputs.first().fill('2026-01-01');
    await expect(dateInputs.first()).toHaveValue('2026-01-01');

    await dateInputs.nth(1).fill('2026-02-28');
    await expect(dateInputs.nth(1)).toHaveValue('2026-02-28');
  });

  test('payment table shows owner name, clinic name, amount, and status columns', async ({
    page,
  }) => {
    await gotoPortalPage(page, '/admin/payments');

    // Wait for table to render
    const table = page.locator('table').or(page.locator('[role="table"]'));
    await expect(table.first()).toBeVisible({ timeout: 5000 });

    // Table headers
    await expect(page.getByRole('columnheader', { name: /owner/i })).toBeVisible();
    await expect(page.getByRole('columnheader', { name: /clinic/i })).toBeVisible();
    await expect(page.getByRole('columnheader', { name: /amount/i })).toBeVisible();
    await expect(page.getByRole('columnheader', { name: /status/i })).toBeVisible();

    // Data from mock: Bob Williams (failed, $106.00), Emily Chen (succeeded), John Smith (succeeded)
    await expect(page.getByText('Bob Williams').first()).toBeVisible();
    await expect(page.getByText('Emily Chen').first()).toBeVisible();
    await expect(page.getByText('John Smith').first()).toBeVisible();

    // Clinic names
    await expect(page.getByText('Happy Paws Veterinary').first()).toBeVisible();
    await expect(page.getByText('Whisker Wellness Clinic').first()).toBeVisible();

    // Status badges
    await expect(page.getByText('Failed').first()).toBeVisible();
    await expect(page.getByText('Succeeded').first()).toBeVisible();
  });

  test('failed payment shows failure reason "Insufficient funds"', async ({ page }) => {
    await gotoPortalPage(page, '/admin/payments');

    // Wait for the table to render
    const table = page.locator('table').or(page.locator('[role="table"]'));
    await expect(table.first()).toBeVisible({ timeout: 5000 });

    // The failed payment (Bob Williams) has failureReason: "Insufficient funds"
    await expect(page.getByText('Insufficient funds').first()).toBeVisible({ timeout: 5000 });
  });
});
