import { afterEach, beforeEach, describe, expect, it, mock } from 'bun:test';
import { CLINIC_SHARE_RATE, PLATFORM_FEE_RATE, PLATFORM_RESERVE_RATE } from '@/lib/constants';
import { percentOfCents } from '@/lib/utils/money';

// ── Mocks ────────────────────────────────────────────────────────────

import { schemaMock } from './stripe/_mock-schema';

mock.module('@/server/db/schema', () => schemaMock);

const mockSelect = mock();

mock.module('@/server/db', () => ({
  db: {
    select: mockSelect,
  },
}));

const {
  calculatePayoutBreakdown,
  calculateApplicationFee,
  getClinicPayoutHistory,
  getClinicEarnings,
} = await import('@/server/services/payout');

// ── calculatePayoutBreakdown tests ───────────────────────────────────

describe('calculatePayoutBreakdown', () => {
  it('correctly splits a $1,200 bill installment payment', () => {
    // A payment from a $1,200 bill with 6% fee:
    // Total with fee: $1,272.00 = 127,200 cents
    // Deposit (25%): $318.00 = 31,800 cents
    // Remaining: $954.00 = 95,400 cents
    // Each installment: $159.00 = 15,900 cents
    const paymentAmountCents = 15_900;
    const breakdown = calculatePayoutBreakdown(paymentAmountCents);

    // Bill portion = 15900 / 1.06 = 15000 (rounded)
    const expectedBillPortion = Math.round(paymentAmountCents / (1 + PLATFORM_FEE_RATE));
    const expectedPlatformFee = paymentAmountCents - expectedBillPortion;
    const expectedRiskPool = percentOfCents(expectedBillPortion, PLATFORM_RESERVE_RATE);
    const expectedClinicShare = percentOfCents(paymentAmountCents, CLINIC_SHARE_RATE);
    const expectedTransfer = expectedBillPortion - expectedRiskPool + expectedClinicShare;

    expect(breakdown.paymentAmountCents).toBe(paymentAmountCents);
    expect(breakdown.platformFeeCents).toBe(expectedPlatformFee);
    expect(breakdown.riskPoolCents).toBe(expectedRiskPool);
    expect(breakdown.clinicShareCents).toBe(expectedClinicShare);
    expect(breakdown.transferAmountCents).toBe(expectedTransfer);
  });

  it('correctly handles a deposit payment of 31,800 cents', () => {
    const paymentAmountCents = 31_800;
    const breakdown = calculatePayoutBreakdown(paymentAmountCents);

    const expectedBillPortion = Math.round(paymentAmountCents / (1 + PLATFORM_FEE_RATE));
    const expectedPlatformFee = paymentAmountCents - expectedBillPortion;
    const expectedRiskPool = percentOfCents(expectedBillPortion, PLATFORM_RESERVE_RATE);
    const expectedClinicShare = percentOfCents(paymentAmountCents, CLINIC_SHARE_RATE);
    const expectedTransfer = expectedBillPortion - expectedRiskPool + expectedClinicShare;

    expect(breakdown.platformFeeCents).toBe(expectedPlatformFee);
    expect(breakdown.riskPoolCents).toBe(expectedRiskPool);
    expect(breakdown.clinicShareCents).toBe(expectedClinicShare);
    expect(breakdown.transferAmountCents).toBe(expectedTransfer);
  });

  it('uses integer cents throughout (no floating point)', () => {
    // Use an amount that could produce fractional cents
    const paymentAmountCents = 12_345;
    const breakdown = calculatePayoutBreakdown(paymentAmountCents);

    expect(Number.isInteger(breakdown.platformFeeCents)).toBe(true);
    expect(Number.isInteger(breakdown.riskPoolCents)).toBe(true);
    expect(Number.isInteger(breakdown.clinicShareCents)).toBe(true);
    expect(Number.isInteger(breakdown.transferAmountCents)).toBe(true);
  });

  it('ensures platform fee + bill portion = payment amount', () => {
    const paymentAmountCents = 15_900;
    const breakdown = calculatePayoutBreakdown(paymentAmountCents);

    const billPortion = Math.round(paymentAmountCents / (1 + PLATFORM_FEE_RATE));
    expect(billPortion + breakdown.platformFeeCents).toBe(paymentAmountCents);
  });

  it('ensures clinic share is exactly 3% of payment amount', () => {
    const paymentAmountCents = 15_900;
    const breakdown = calculatePayoutBreakdown(paymentAmountCents);

    expect(breakdown.clinicShareCents).toBe(percentOfCents(paymentAmountCents, CLINIC_SHARE_RATE));
  });

  it('ensures transfer amount includes clinic share bonus', () => {
    const paymentAmountCents = 15_900;
    const breakdown = calculatePayoutBreakdown(paymentAmountCents);

    // Transfer = bill portion - risk pool + clinic share
    const billPortion = Math.round(paymentAmountCents / (1 + PLATFORM_FEE_RATE));
    const withoutBonus = billPortion - breakdown.riskPoolCents;
    expect(breakdown.transferAmountCents).toBe(withoutBonus + breakdown.clinicShareCents);
  });

  it('throws for zero amount', () => {
    expect(() => calculatePayoutBreakdown(0)).toThrow(RangeError);
  });

  it('throws for negative amount', () => {
    expect(() => calculatePayoutBreakdown(-100)).toThrow(RangeError);
  });

  it('throws for NaN', () => {
    expect(() => calculatePayoutBreakdown(Number.NaN)).toThrow(RangeError);
  });

  it('throws for Infinity', () => {
    expect(() => calculatePayoutBreakdown(Number.POSITIVE_INFINITY)).toThrow(RangeError);
  });

  it('handles minimum bill installment ($500 bill)', () => {
    // $500 bill + 6% = $530 total, 25% deposit = $132.50 = 13,250 cents
    // Remaining = $397.50 = 39,750 cents, installment = $66.25 = 6,625 cents
    const paymentAmountCents = 6_625;
    const breakdown = calculatePayoutBreakdown(paymentAmountCents);

    expect(breakdown.paymentAmountCents).toBe(6_625);
    expect(breakdown.transferAmountCents).toBeGreaterThan(0);
    expect(breakdown.platformFeeCents).toBeGreaterThan(0);
    expect(breakdown.riskPoolCents).toBeGreaterThan(0);
    expect(breakdown.clinicShareCents).toBeGreaterThan(0);
  });

  it('handles large bill amounts ($10,000 bill)', () => {
    // $10,000 + 6% = $10,600, deposit 25% = $2,650 = 265,000 cents
    const paymentAmountCents = 265_000;
    const breakdown = calculatePayoutBreakdown(paymentAmountCents);

    expect(breakdown.paymentAmountCents).toBe(265_000);
    expect(breakdown.transferAmountCents).toBeGreaterThan(0);
    // Platform fee should be roughly 6/106 of the payment
    expect(breakdown.platformFeeCents).toBeGreaterThan(0);
  });
});

// ── calculateApplicationFee tests ────────────────────────────────────

describe('calculateApplicationFee', () => {
  it('satisfies applicationFee + transferAmount = paymentAmount', () => {
    const paymentAmountCents = 15_900;
    const fee = calculateApplicationFee(paymentAmountCents);
    const breakdown = calculatePayoutBreakdown(paymentAmountCents);
    expect(fee + breakdown.transferAmountCents).toBe(paymentAmountCents);
  });

  it('returns integer cents', () => {
    expect(Number.isInteger(calculateApplicationFee(12_345))).toBe(true);
    expect(Number.isInteger(calculateApplicationFee(15_900))).toBe(true);
    expect(Number.isInteger(calculateApplicationFee(265_000))).toBe(true);
  });

  it('is positive for all valid payment amounts', () => {
    expect(calculateApplicationFee(6_625)).toBeGreaterThan(0);
    expect(calculateApplicationFee(15_900)).toBeGreaterThan(0);
    expect(calculateApplicationFee(265_000)).toBeGreaterThan(0);
  });

  it('delegates validation to calculatePayoutBreakdown', () => {
    expect(() => calculateApplicationFee(0)).toThrow(RangeError);
    expect(() => calculateApplicationFee(-100)).toThrow(RangeError);
    expect(() => calculateApplicationFee(Number.NaN)).toThrow(RangeError);
  });
});

// ── getClinicPayoutHistory tests ─────────────────────────────────────

describe('getClinicPayoutHistory', () => {
  const payoutData = [
    {
      id: 'payout-1',
      planId: 'plan-1',
      paymentId: 'pay-1',
      amountCents: 15_327,
      clinicShareCents: 477,
      stripeTransferId: 'tr_123',
      status: 'succeeded',
      createdAt: new Date('2026-02-01'),
    },
  ];

  beforeEach(() => {
    // Use argument-based differentiation instead of brittle callCount.
    // The data query calls .from().where().orderBy().limit().offset(),
    // while the count query calls .from().where() and resolves directly.
    mockSelect.mockImplementation((fields: Record<string, unknown>) => {
      if ('total' in fields) {
        // Count query: db.select({ total: count() })
        return {
          from: mock(() => ({
            where: mock(() => Promise.resolve([{ total: 1 }])),
          })),
        };
      }
      // Data query: db.select({ id, planId, ... })
      return {
        from: mock(() => ({
          where: mock(() => ({
            orderBy: mock(() => ({
              limit: mock(() => ({
                offset: mock(() => Promise.resolve(payoutData)),
              })),
            })),
          })),
        })),
      };
    });
  });

  afterEach(() => {
    mockSelect.mockClear();
  });

  it('returns paginated payout data', async () => {
    const result = await getClinicPayoutHistory('clinic-1');

    expect(result.payouts).toHaveLength(1);
    expect(result.payouts[0].id).toBe('payout-1');
    expect(result.payouts[0].amountCents).toBe(15_327);
    expect(result.total).toBe(1);
  });

  it('respects custom limit and offset', async () => {
    const result = await getClinicPayoutHistory('clinic-1', { limit: 10, offset: 5 });

    expect(result.payouts).toBeDefined();
    expect(result.total).toBeDefined();
  });
});

// ── getClinicEarnings tests ──────────────────────────────────────────

describe('getClinicEarnings', () => {
  beforeEach(() => {
    // Use argument-based differentiation instead of brittle callCount.
    // Each select call passes different field names, so we inspect the keys.
    mockSelect.mockImplementation((fields: Record<string, unknown>) => {
      if ('totalPayout' in fields) {
        // Succeeded totals: db.select({ totalPayout, totalShare })
        return {
          from: mock(() => ({
            where: mock(() => Promise.resolve([{ totalPayout: '150000', totalShare: '4500' }])),
          })),
        };
      }
      if ('pendingPayout' in fields) {
        // Pending totals: db.select({ pendingPayout })
        return {
          from: mock(() => ({
            where: mock(() => Promise.resolve([{ pendingPayout: '15900' }])),
          })),
        };
      }
      // Completed count: db.select({ completedCount })
      return {
        from: mock(() => ({
          where: mock(() => Promise.resolve([{ completedCount: 10 }])),
        })),
      };
    });
  });

  afterEach(() => {
    mockSelect.mockClear();
  });

  it('returns aggregate earnings data', async () => {
    const result = await getClinicEarnings('clinic-1');

    expect(result.totalPayoutCents).toBe(150_000);
    expect(result.totalClinicShareCents).toBe(4_500);
    expect(result.pendingPayoutCents).toBe(15_900);
    expect(result.completedPayoutCount).toBe(10);
  });
});
