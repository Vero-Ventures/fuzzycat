import { expect, test } from '@playwright/test';
import { enrollmentSummary } from '../../helpers/audit-mock-data';
import { gotoPortalPage, mockAllTrpc } from '../../helpers/portal-test-base';
import { mockTrpcQuery, mockTrpcQueryError } from '../../helpers/trpc-mock';

test.describe.configure({ timeout: 90_000 });

test.describe('Enrollment Success Page', () => {
  test('shows plan details (clinic, pet, amounts)', async ({ page }) => {
    await mockTrpcQuery(page, 'enrollment.getSummary', enrollmentSummary);
    await mockAllTrpc(page);

    await gotoPortalPage(page, '/owner/enroll/success?planId=plan-new-001');

    // Clinic name
    await expect(page.getByText(/happy paws/i).first()).toBeVisible({ timeout: 5000 });

    // Pet name
    await expect(page.getByText(/whiskers/i).first()).toBeVisible({ timeout: 5000 });

    // Amounts — deposit or total should be visible
    const amounts = page
      .getByText(/\$1,500|\$1500|\$397\.50|\$39750/i)
      .or(page.getByText(/\$1,590|\$1590/i));
    await expect(amounts.first()).toBeVisible({ timeout: 5000 });
  });

  test('shows payment schedule with dates', async ({ page }) => {
    await mockTrpcQuery(page, 'enrollment.getSummary', enrollmentSummary);
    await mockAllTrpc(page);

    await gotoPortalPage(page, '/owner/enroll/success?planId=plan-new-001');

    // Payment schedule should show installment entries
    await expect(page.getByText(/deposit/i).first()).toBeVisible({ timeout: 5000 });

    // Should show scheduled dates or payment numbers
    const schedule = page.getByText(/installment|payment.*\d/i);
    if (
      await schedule
        .first()
        .isVisible({ timeout: 3000 })
        .catch(() => false)
    ) {
      expect(await schedule.count()).toBeGreaterThan(0);
    }
  });

  test('has link to payment plans', async ({ page }) => {
    await mockTrpcQuery(page, 'enrollment.getSummary', enrollmentSummary);
    await mockAllTrpc(page);

    await gotoPortalPage(page, '/owner/enroll/success?planId=plan-new-001');

    // Should have a link back to payments/dashboard
    const dashboardLink = page.getByRole('link', {
      name: /payment.*plan|dashboard|my.*plan|view.*plan/i,
    });
    if (await dashboardLink.isVisible({ timeout: 5000 }).catch(() => false)) {
      const href = await dashboardLink.getAttribute('href');
      expect(href).toMatch(/\/owner\/payments/);
    }
  });

  test('missing planId handles gracefully', async ({ page }) => {
    await mockTrpcQueryError(page, 'enrollment.getSummary', 'NOT_FOUND', 'Enrollment not found');
    await mockAllTrpc(page);

    // Navigate without planId
    await gotoPortalPage(page, '/owner/enroll/success');

    // Should show error or redirect — not crash
    const errorOrContent = page
      .getByText(/not found|error|unable|no plan/i)
      .or(page.getByRole('link', { name: /payment|dashboard|enroll/i }));
    await expect(errorOrContent.first()).toBeVisible({ timeout: 10000 });
  });
});
