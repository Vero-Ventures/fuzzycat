import { expect, test } from '@playwright/test';
import { mockTrpcQuery } from '../../helpers/trpc-mock';

test.describe('Owner Enrollment Success Page', () => {
  test.beforeEach(async ({ page }) => {
    // Mock the enrollment summary tRPC query so the page renders
    // without a real backend. When no planId is provided or the query
    // fails, the page shows a generic success message with a fallback card.
    await mockTrpcQuery(page, 'enrollment.getSummary', {
      clinic: { name: 'Happy Paws Veterinary' },
      owner: { petName: 'Whiskers' },
      plan: {
        totalBillCents: 120000,
        totalWithFeeCents: 127200,
      },
      payments: [
        {
          id: 'pay-1',
          type: 'deposit',
          sequenceNum: null,
          amountCents: 31800,
          status: 'succeeded',
          scheduledAt: new Date().toISOString(),
        },
        {
          id: 'pay-2',
          type: 'installment',
          sequenceNum: 1,
          amountCents: 15900,
          status: 'pending',
          scheduledAt: new Date(Date.now() + 14 * 86400000).toISOString(),
        },
        {
          id: 'pay-3',
          type: 'installment',
          sequenceNum: 2,
          amountCents: 15900,
          status: 'pending',
          scheduledAt: new Date(Date.now() + 28 * 86400000).toISOString(),
        },
      ],
    });

    await page.goto('/owner/enroll/success?planId=mock-plan-id');
  });

  test('loads success page with heading', async ({ page }, testInfo) => {
    await expect(page.getByRole('heading', { name: /you are all set/i })).toBeVisible();

    await testInfo.attach('success-heading', {
      body: await page.screenshot(),
      contentType: 'image/png',
    });
  });

  test('shows confirmation message about plan being active', async ({ page }) => {
    await expect(
      page.getByText(/your deposit has been paid and your payment plan is now active/i),
    ).toBeVisible();
  });

  test('has link back to payments page', async ({ page }) => {
    const paymentsLink = page.getByRole('link', {
      name: /view my payments/i,
    });
    await expect(paymentsLink).toBeVisible();
    await expect(paymentsLink).toHaveAttribute('href', '/owner/payments');
  });

  test('captures screenshot of success page', async ({ page }, testInfo) => {
    // Wait for tRPC data to load and render
    await page.waitForLoadState('domcontentloaded');

    await testInfo.attach('enrollment-success-full', {
      body: await page.screenshot({ fullPage: true }),
      contentType: 'image/png',
    });
  });
});
