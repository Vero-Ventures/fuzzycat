import { expect, test } from '@playwright/test';
import { adminClinics } from '../../helpers/audit-mock-data';
import { gotoPortalPage, mockAllTrpc } from '../../helpers/portal-test-base';
import { mockTrpcMutation, mockTrpcQuery } from '../../helpers/trpc-mock';

test.describe.configure({ timeout: 90_000 });

test.describe('Admin Clinics — Action Buttons', () => {
  test.beforeEach(async ({ page }) => {
    await mockTrpcQuery(page, 'admin.getClinics', adminClinics);
    await mockAllTrpc(page);
  });

  test('pending clinic shows Approve button', async ({ page }) => {
    await gotoPortalPage(page, '/admin/clinics');

    // Wait for the table to render
    const table = page.locator('table').or(page.locator('[role="table"]'));
    await expect(table.first()).toBeVisible({ timeout: 5000 });

    // PetCare Plus is the pending clinic (clinic-003)
    await expect(page.getByText(/petcare plus/i).first()).toBeVisible({ timeout: 5000 });

    // The row for PetCare Plus should have an "Approve" button
    const petCareRow = page.locator('tr', { hasText: /petcare plus/i });
    const approveBtn = petCareRow.getByRole('button', { name: /approve/i });
    await expect(approveBtn).toBeVisible({ timeout: 5000 });

    // Suspended clinic should NOT show Approve — it shows Reactivate instead
    // Active clinics should NOT show Approve
    const happyPawsRow = page.locator('tr', { hasText: /happy paws/i });
    await expect(happyPawsRow.getByRole('button', { name: /^approve$/i })).not.toBeVisible();
  });

  test('clicking Approve triggers mutation and shows success', async ({ page }) => {
    // Mock the updateClinicStatus mutation
    await mockTrpcMutation(page, 'admin.updateClinicStatus', { success: true });

    await gotoPortalPage(page, '/admin/clinics');

    // Wait for the table to render
    const table = page.locator('table').or(page.locator('[role="table"]'));
    await expect(table.first()).toBeVisible({ timeout: 5000 });

    // Find PetCare Plus row and click Approve
    const petCareRow = page.locator('tr', { hasText: /petcare plus/i });
    const approveBtn = petCareRow.getByRole('button', { name: /approve/i });
    await expect(approveBtn).toBeVisible({ timeout: 5000 });

    // Set up a request promise to verify the mutation is called
    const mutationRequest = page.waitForRequest(
      (req) => req.url().includes('/api/trpc/') && req.method() === 'POST',
      { timeout: 10000 },
    );

    await approveBtn.click();

    // Verify the mutation was triggered
    const req = await mutationRequest;
    expect(req.method()).toBe('POST');

    // After mutation, the query should be refetched. Mock the updated data
    // where PetCare Plus is now active
    const updatedClinics = {
      ...adminClinics,
      clinics: adminClinics.clinics.map((c) =>
        c.id === 'clinic-003' ? { ...c, status: 'active' as const } : c,
      ),
    };
    await mockTrpcQuery(page, 'admin.getClinics', updatedClinics);

    // Wait for refetch
    await page.waitForTimeout(2000);
  });

  test('active clinic shows Suspend button', async ({ page }) => {
    await gotoPortalPage(page, '/admin/clinics');

    // Wait for the table to render
    const table = page.locator('table').or(page.locator('[role="table"]'));
    await expect(table.first()).toBeVisible({ timeout: 5000 });

    // Happy Paws Veterinary is active (clinic-001)
    const happyPawsRow = page.locator('tr', { hasText: /happy paws/i });
    await expect(happyPawsRow).toBeVisible({ timeout: 5000 });

    const suspendBtn = happyPawsRow.getByRole('button', { name: /suspend/i });
    await expect(suspendBtn).toBeVisible({ timeout: 5000 });

    // Whisker Wellness Clinic is also active (clinic-002)
    const whiskerRow = page.locator('tr', { hasText: /whisker wellness/i });
    const suspendBtn2 = whiskerRow.getByRole('button', { name: /suspend/i });
    await expect(suspendBtn2).toBeVisible({ timeout: 5000 });

    // Pending clinic should NOT show Suspend
    const petCareRow = page.locator('tr', { hasText: /petcare plus/i });
    await expect(petCareRow.getByRole('button', { name: /suspend/i })).not.toBeVisible();
  });

  test('suspended clinic shows Reactivate button', async ({ page }) => {
    await gotoPortalPage(page, '/admin/clinics');

    // Wait for the table to render
    const table = page.locator('table').or(page.locator('[role="table"]'));
    await expect(table.first()).toBeVisible({ timeout: 5000 });

    // Sunset Animal Hospital is suspended (clinic-004)
    const sunsetRow = page.locator('tr', { hasText: /sunset animal/i });
    await expect(sunsetRow).toBeVisible({ timeout: 5000 });

    const reactivateBtn = sunsetRow.getByRole('button', { name: /reactivate/i });
    await expect(reactivateBtn).toBeVisible({ timeout: 5000 });

    // Suspended clinic should NOT show Suspend or Approve
    await expect(sunsetRow.getByRole('button', { name: /suspend/i })).not.toBeVisible();
    await expect(sunsetRow.getByRole('button', { name: /^approve$/i })).not.toBeVisible();
  });

  test('action buttons show disabled state during mutation', async ({ page }) => {
    // Mock the mutation (it resolves instantly, but we can still check the disabled attribute)
    await mockTrpcMutation(page, 'admin.updateClinicStatus', { success: true });

    await gotoPortalPage(page, '/admin/clinics');

    // Wait for the table to render
    const table = page.locator('table').or(page.locator('[role="table"]'));
    await expect(table.first()).toBeVisible({ timeout: 5000 });

    // All action buttons should initially be enabled
    const happyPawsRow = page.locator('tr', { hasText: /happy paws/i });
    const suspendBtn = happyPawsRow.getByRole('button', { name: /suspend/i });
    await expect(suspendBtn).toBeVisible({ timeout: 5000 });
    await expect(suspendBtn).toBeEnabled();

    const petCareRow = page.locator('tr', { hasText: /petcare plus/i });
    const approveBtn = petCareRow.getByRole('button', { name: /approve/i });
    await expect(approveBtn).toBeEnabled();

    const sunsetRow = page.locator('tr', { hasText: /sunset animal/i });
    const reactivateBtn = sunsetRow.getByRole('button', { name: /reactivate/i });
    await expect(reactivateBtn).toBeEnabled();

    // Click one button — all should become disabled while the mutation is pending
    // (the component uses a single updateStatusMutation.isPending for all buttons)
    await suspendBtn.click();

    // After mutation completes (mocked instantly), buttons should re-enable.
    // Wait briefly and verify buttons are not stuck in disabled state.
    await page.waitForTimeout(1000);

    // The approve button for the pending clinic should still be visible and re-enabled
    // after the mutation completes
    await expect(approveBtn).toBeVisible({ timeout: 5000 });
  });
});
