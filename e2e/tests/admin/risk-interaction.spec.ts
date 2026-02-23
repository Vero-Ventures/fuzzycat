import { expect, test } from '@playwright/test';
import {
  adminDefaultedPlans,
  adminRiskPoolBalance,
  adminRiskPoolDetails,
  adminRiskPoolHealth,
  adminSoftCollectionStats,
  adminSoftCollections,
} from '../../helpers/audit-mock-data';
import { gotoPortalPage, mockAllTrpc } from '../../helpers/portal-test-base';
import { mockTrpcQuery } from '../../helpers/trpc-mock';

test.describe.configure({ timeout: 90_000 });

test.describe('Admin Risk — Interactions', () => {
  test.beforeEach(async ({ page }) => {
    await mockTrpcQuery(page, 'admin.riskPoolBalance', adminRiskPoolBalance);
    await mockTrpcQuery(page, 'admin.riskPoolHealth', adminRiskPoolHealth);
    await mockTrpcQuery(page, 'admin.getRiskPoolDetails', adminRiskPoolDetails);
    await mockTrpcQuery(page, 'admin.getSoftCollections', adminSoftCollections);
    await mockTrpcQuery(page, 'admin.getDefaultedPlans', adminDefaultedPlans);
    await mockTrpcQuery(page, 'admin.getSoftCollectionStats', adminSoftCollectionStats);
    await mockAllTrpc(page);
  });

  test('platform reserve balance breakdown renders', async ({ page }) => {
    await gotoPortalPage(page, '/admin/risk');

    // Balance: $12,500.00
    await expect(page.getByText(/\$12,500/).first()).toBeVisible({ timeout: 5000 });

    // Contributions
    await expect(page.getByText(/contribution/i).first()).toBeVisible({ timeout: 5000 });
  });

  test('reserve entries table renders', async ({ page }) => {
    await gotoPortalPage(page, '/admin/risk');

    // Reserve entries
    const table = page.locator('table').or(page.locator('[role="table"]'));
    await expect(table.first()).toBeVisible({ timeout: 5000 });
  });

  test('soft collections table renders', async ({ page }) => {
    await gotoPortalPage(page, '/admin/risk');

    // Soft collection entries
    await expect(page.getByText(/bob williams/i).first()).toBeVisible({ timeout: 5000 });
    await expect(page.getByText(/sarah lee/i).first()).toBeVisible({ timeout: 5000 });
  });

  test('soft collection stats render', async ({ page }) => {
    await gotoPortalPage(page, '/admin/risk');

    // Total collections: 15
    await expect(page.getByText('15').first()).toBeVisible({ timeout: 5000 });

    // Recovery rate: 20%
    await expect(page.getByText(/20/).first()).toBeVisible({ timeout: 5000 });
  });

  test('defaulted plans table renders', async ({ page }) => {
    await gotoPortalPage(page, '/admin/risk');

    // Defaulted plan details
    await expect(page.getByText(/bob williams/i).first()).toBeVisible({ timeout: 5000 });
    await expect(page.getByText(/mike brown/i).first()).toBeVisible({ timeout: 5000 });
  });
});
