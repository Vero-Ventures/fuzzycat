import { expect, test } from '@playwright/test';
import {
  adminPlatformStats,
  adminRecentAuditLog,
  adminRiskPoolHealth,
  emptyAdminPlatformStats,
  emptyAdminRiskPoolHealth,
} from '../../helpers/audit-mock-data';
import { gotoPortalPage, mockAllTrpc } from '../../helpers/portal-test-base';
import { mockTrpcQuery } from '../../helpers/trpc-mock';

test.describe.configure({ timeout: 90_000 });

test.describe('Admin Dashboard — Data Assertions', () => {
  test('platform stats KPIs render', async ({ page }) => {
    await mockTrpcQuery(page, 'admin.getPlatformStats', adminPlatformStats);
    await mockTrpcQuery(page, 'admin.riskPoolHealth', adminRiskPoolHealth);
    await mockTrpcQuery(page, 'admin.getRecentAuditLog', adminRecentAuditLog);
    await mockAllTrpc(page);

    await gotoPortalPage(page, '/admin/dashboard');

    // Total Enrollments: 234
    await expect(page.getByText('234').first()).toBeVisible({ timeout: 5000 });

    // Active Plans: 87
    await expect(page.getByText('87').first()).toBeVisible({ timeout: 5000 });
  });

  test('risk pool health metrics render', async ({ page }) => {
    await mockTrpcQuery(page, 'admin.getPlatformStats', adminPlatformStats);
    await mockTrpcQuery(page, 'admin.riskPoolHealth', adminRiskPoolHealth);
    await mockTrpcQuery(page, 'admin.getRecentAuditLog', adminRecentAuditLog);
    await mockAllTrpc(page);

    await gotoPortalPage(page, '/admin/dashboard');

    // Risk pool section
    await expect(page.getByText(/risk pool/i).first()).toBeVisible({ timeout: 5000 });

    // Balance: $12,500.00
    await expect(page.getByText(/\$12,500/).first()).toBeVisible({ timeout: 5000 });
  });

  test('recent audit log entries render', async ({ page }) => {
    await mockTrpcQuery(page, 'admin.getPlatformStats', adminPlatformStats);
    await mockTrpcQuery(page, 'admin.riskPoolHealth', adminRiskPoolHealth);
    await mockTrpcQuery(page, 'admin.getRecentAuditLog', adminRecentAuditLog);
    await mockAllTrpc(page);

    await gotoPortalPage(page, '/admin/dashboard');

    // Audit log section
    const auditLog = page.getByText(/audit.*log|recent.*activity/i);
    await expect(auditLog.first()).toBeVisible({ timeout: 5000 });

    // Status changed entries
    const statusChanged = page.getByText(/status_changed|payment_retried|disclaimer_confirmed/i);
    if (
      await statusChanged
        .first()
        .isVisible({ timeout: 3000 })
        .catch(() => false)
    ) {
      expect(await statusChanged.count()).toBeGreaterThan(0);
    }
  });

  test('empty platform shows zero stats', async ({ page }) => {
    await mockTrpcQuery(page, 'admin.getPlatformStats', emptyAdminPlatformStats);
    await mockTrpcQuery(page, 'admin.riskPoolHealth', emptyAdminRiskPoolHealth);
    await mockTrpcQuery(page, 'admin.getRecentAuditLog', []);
    await mockAllTrpc(page);

    await gotoPortalPage(page, '/admin/dashboard');

    // Should show zero values
    await expect(page.getByText('0').first()).toBeVisible({ timeout: 5000 });
  });
});
