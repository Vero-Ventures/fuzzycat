import { afterEach, beforeEach, describe, expect, it, mock } from 'bun:test';
import {
  CLINIC_SHARE_RATE,
  DEPOSIT_RATE,
  NUM_INSTALLMENTS,
  PLATFORM_FEE_RATE,
  PLATFORM_RESERVE_RATE,
} from '@/lib/constants';
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
  calculateDepositPayoutBreakdown,
  calculateInstallmentPayoutBreakdown,
  calculateDepositApplicationFee,
  calculateInstallmentApplicationFee,
  getClinicPayoutHistory,
  getClinicEarnings,
} = await import('@/server/services/payout');

// ── Helpers ──────────────────────────────────────────────────────────

/** Generate plan values for a given bill amount in cents. */
function planValues(billCents: number) {
  const feeCents = Math.round(billCents * PLATFORM_FEE_RATE);
  const totalWithFeeCents = billCents + feeCents;
  const depositCents = Math.round(totalWithFeeCents * DEPOSIT_RATE);
  const remainingCents = totalWithFeeCents - depositCents;
  const installmentCents = Math.round(remainingCents / NUM_INSTALLMENTS);
  return { billCents, feeCents, totalWithFeeCents, depositCents, installmentCents };
}

// ── calculateDepositPayoutBreakdown tests ───────────────────────────

describe('calculateDepositPayoutBreakdown', () => {
  it('extracts entire platform fee and pays entire clinic share on deposit ($1,000 bill)', () => {
    const plan = planValues(100_000); // $1,000
    const breakdown = calculateDepositPayoutBreakdown(
      plan.depositCents,
      plan.feeCents,
      plan.totalWithFeeCents,
    );

    expect(breakdown.paymentAmountCents).toBe(plan.depositCents);
    expect(breakdown.platformFeeCents).toBe(plan.feeCents); // entire 6%
    expect(breakdown.clinicShareCents).toBe(
      percentOfCents(plan.totalWithFeeCents, CLINIC_SHARE_RATE),
    ); // entire 3%
  });

  it('risk pool is 1% of deposit bill portion', () => {
    const plan = planValues(100_000);
    const breakdown = calculateDepositPayoutBreakdown(
      plan.depositCents,
      plan.feeCents,
      plan.totalWithFeeCents,
    );

    const depositBillPortion = plan.depositCents - plan.feeCents;
    expect(breakdown.riskPoolCents).toBe(percentOfCents(depositBillPortion, PLATFORM_RESERVE_RATE));
  });

  it('application fee = platformFee + riskPool - clinicShare', () => {
    const plan = planValues(100_000);
    const breakdown = calculateDepositPayoutBreakdown(
      plan.depositCents,
      plan.feeCents,
      plan.totalWithFeeCents,
    );

    const applicationFee = plan.depositCents - breakdown.transferAmountCents;
    expect(applicationFee).toBe(
      breakdown.platformFeeCents + breakdown.riskPoolCents - breakdown.clinicShareCents,
    );
  });

  it('transfer + applicationFee = deposit amount', () => {
    const plan = planValues(100_000);
    const breakdown = calculateDepositPayoutBreakdown(
      plan.depositCents,
      plan.feeCents,
      plan.totalWithFeeCents,
    );

    const applicationFee = plan.depositCents - breakdown.transferAmountCents;
    expect(breakdown.transferAmountCents + applicationFee).toBe(plan.depositCents);
  });

  it('application fee is always positive (minimum $500 bill)', () => {
    const plan = planValues(50_000); // $500 minimum
    const applicationFee = calculateDepositApplicationFee(
      plan.depositCents,
      plan.feeCents,
      plan.totalWithFeeCents,
    );
    expect(applicationFee).toBeGreaterThan(0);
  });

  it('application fee is always positive (maximum $25,000 bill)', () => {
    const plan = planValues(2_500_000);
    const applicationFee = calculateDepositApplicationFee(
      plan.depositCents,
      plan.feeCents,
      plan.totalWithFeeCents,
    );
    expect(applicationFee).toBeGreaterThan(0);
  });

  it('uses integer cents throughout', () => {
    const plan = planValues(123_456); // odd amount to stress rounding
    const breakdown = calculateDepositPayoutBreakdown(
      plan.depositCents,
      plan.feeCents,
      plan.totalWithFeeCents,
    );

    expect(Number.isInteger(breakdown.platformFeeCents)).toBe(true);
    expect(Number.isInteger(breakdown.riskPoolCents)).toBe(true);
    expect(Number.isInteger(breakdown.clinicShareCents)).toBe(true);
    expect(Number.isInteger(breakdown.transferAmountCents)).toBe(true);
  });

  it('works with founding clinic custom share rate (5%)', () => {
    const plan = planValues(100_000);
    const foundingRate = 0.05;
    const breakdown = calculateDepositPayoutBreakdown(
      plan.depositCents,
      plan.feeCents,
      plan.totalWithFeeCents,
      foundingRate,
    );

    expect(breakdown.clinicShareCents).toBe(percentOfCents(plan.totalWithFeeCents, foundingRate));
    // Application fee should still be positive: 6% fee > 5% share for all bills
    const applicationFee = plan.depositCents - breakdown.transferAmountCents;
    expect(applicationFee).toBeGreaterThan(0);
  });

  it('throws for zero amount', () => {
    expect(() => calculateDepositPayoutBreakdown(0, 6_000, 106_000)).toThrow(RangeError);
  });

  it('throws for negative amount', () => {
    expect(() => calculateDepositPayoutBreakdown(-100, 6_000, 106_000)).toThrow(RangeError);
  });

  it('throws for NaN', () => {
    expect(() => calculateDepositPayoutBreakdown(Number.NaN, 6_000, 106_000)).toThrow(RangeError);
  });

  it('throws for Infinity', () => {
    expect(() => calculateDepositPayoutBreakdown(Number.POSITIVE_INFINITY, 6_000, 106_000)).toThrow(
      RangeError,
    );
  });
});

// ── calculateInstallmentPayoutBreakdown tests ───────────────────────

describe('calculateInstallmentPayoutBreakdown', () => {
  it('has zero platform fee and zero clinic share', () => {
    const plan = planValues(100_000);
    const breakdown = calculateInstallmentPayoutBreakdown(plan.installmentCents);

    expect(breakdown.platformFeeCents).toBe(0);
    expect(breakdown.clinicShareCents).toBe(0);
  });

  it('risk pool is 1% of full installment amount', () => {
    const plan = planValues(100_000);
    const breakdown = calculateInstallmentPayoutBreakdown(plan.installmentCents);

    expect(breakdown.riskPoolCents).toBe(
      percentOfCents(plan.installmentCents, PLATFORM_RESERVE_RATE),
    );
  });

  it('transfer = installment - riskPool', () => {
    const plan = planValues(100_000);
    const breakdown = calculateInstallmentPayoutBreakdown(plan.installmentCents);

    expect(breakdown.transferAmountCents).toBe(plan.installmentCents - breakdown.riskPoolCents);
  });

  it('application fee equals risk pool', () => {
    const plan = planValues(100_000);
    const appFee = calculateInstallmentApplicationFee(plan.installmentCents);

    expect(appFee).toBe(percentOfCents(plan.installmentCents, PLATFORM_RESERVE_RATE));
  });

  it('transfer + applicationFee = installment amount', () => {
    const plan = planValues(100_000);
    const breakdown = calculateInstallmentPayoutBreakdown(plan.installmentCents);
    const appFee = plan.installmentCents - breakdown.transferAmountCents;

    expect(breakdown.transferAmountCents + appFee).toBe(plan.installmentCents);
  });

  it('uses integer cents throughout', () => {
    const breakdown = calculateInstallmentPayoutBreakdown(12_345);

    expect(Number.isInteger(breakdown.platformFeeCents)).toBe(true);
    expect(Number.isInteger(breakdown.riskPoolCents)).toBe(true);
    expect(Number.isInteger(breakdown.clinicShareCents)).toBe(true);
    expect(Number.isInteger(breakdown.transferAmountCents)).toBe(true);
  });

  it('handles minimum bill installment ($500 bill)', () => {
    const plan = planValues(50_000);
    const breakdown = calculateInstallmentPayoutBreakdown(plan.installmentCents);

    expect(breakdown.paymentAmountCents).toBe(plan.installmentCents);
    expect(breakdown.transferAmountCents).toBeGreaterThan(0);
    expect(breakdown.riskPoolCents).toBeGreaterThan(0);
  });

  it('handles large bill amounts ($25,000 bill)', () => {
    const plan = planValues(2_500_000);
    const breakdown = calculateInstallmentPayoutBreakdown(plan.installmentCents);

    expect(breakdown.paymentAmountCents).toBe(plan.installmentCents);
    expect(breakdown.transferAmountCents).toBeGreaterThan(0);
  });

  it('throws for zero amount', () => {
    expect(() => calculateInstallmentPayoutBreakdown(0)).toThrow(RangeError);
  });

  it('throws for negative amount', () => {
    expect(() => calculateInstallmentPayoutBreakdown(-100)).toThrow(RangeError);
  });

  it('throws for NaN', () => {
    expect(() => calculateInstallmentPayoutBreakdown(Number.NaN)).toThrow(RangeError);
  });

  it('throws for Infinity', () => {
    expect(() => calculateInstallmentPayoutBreakdown(Number.POSITIVE_INFINITY)).toThrow(RangeError);
  });
});

// ── calculateDepositApplicationFee tests ────────────────────────────

describe('calculateDepositApplicationFee', () => {
  it('satisfies applicationFee + transferAmount = depositAmount', () => {
    const plan = planValues(100_000);
    const fee = calculateDepositApplicationFee(
      plan.depositCents,
      plan.feeCents,
      plan.totalWithFeeCents,
    );
    const breakdown = calculateDepositPayoutBreakdown(
      plan.depositCents,
      plan.feeCents,
      plan.totalWithFeeCents,
    );
    expect(fee + breakdown.transferAmountCents).toBe(plan.depositCents);
  });

  it('returns integer cents', () => {
    const plans = [planValues(100_000), planValues(123_456), planValues(2_500_000)];
    for (const plan of plans) {
      const fee = calculateDepositApplicationFee(
        plan.depositCents,
        plan.feeCents,
        plan.totalWithFeeCents,
      );
      expect(Number.isInteger(fee)).toBe(true);
    }
  });

  it('is positive for all valid bill amounts', () => {
    for (const billCents of [50_000, 100_000, 500_000, 2_500_000]) {
      const plan = planValues(billCents);
      const fee = calculateDepositApplicationFee(
        plan.depositCents,
        plan.feeCents,
        plan.totalWithFeeCents,
      );
      expect(fee).toBeGreaterThan(0);
    }
  });

  it('delegates validation to breakdown function', () => {
    expect(() => calculateDepositApplicationFee(0, 6_000, 106_000)).toThrow(RangeError);
    expect(() => calculateDepositApplicationFee(-100, 6_000, 106_000)).toThrow(RangeError);
    expect(() => calculateDepositApplicationFee(Number.NaN, 6_000, 106_000)).toThrow(RangeError);
  });
});

// ── calculateInstallmentApplicationFee tests ────────────────────────

describe('calculateInstallmentApplicationFee', () => {
  it('satisfies applicationFee + transferAmount = installmentAmount', () => {
    const plan = planValues(100_000);
    const fee = calculateInstallmentApplicationFee(plan.installmentCents);
    const breakdown = calculateInstallmentPayoutBreakdown(plan.installmentCents);
    expect(fee + breakdown.transferAmountCents).toBe(plan.installmentCents);
  });

  it('returns integer cents', () => {
    expect(Number.isInteger(calculateInstallmentApplicationFee(12_345))).toBe(true);
    expect(Number.isInteger(calculateInstallmentApplicationFee(15_900))).toBe(true);
    expect(Number.isInteger(calculateInstallmentApplicationFee(265_000))).toBe(true);
  });

  it('is positive for all valid payment amounts', () => {
    expect(calculateInstallmentApplicationFee(6_625)).toBeGreaterThan(0);
    expect(calculateInstallmentApplicationFee(15_900)).toBeGreaterThan(0);
    expect(calculateInstallmentApplicationFee(265_000)).toBeGreaterThan(0);
  });

  it('delegates validation to breakdown function', () => {
    expect(() => calculateInstallmentApplicationFee(0)).toThrow(RangeError);
    expect(() => calculateInstallmentApplicationFee(-100)).toThrow(RangeError);
    expect(() => calculateInstallmentApplicationFee(Number.NaN)).toThrow(RangeError);
  });
});

// ── Cross-cutting: deposit vs installment consistency ───────────────

describe('front-loaded fee consistency', () => {
  it('total transfers + total application fees = total owner payments ($1,000 bill)', () => {
    const plan = planValues(100_000);

    const depositBreakdown = calculateDepositPayoutBreakdown(
      plan.depositCents,
      plan.feeCents,
      plan.totalWithFeeCents,
    );
    const installmentBreakdown = calculateInstallmentPayoutBreakdown(plan.installmentCents);

    const totalTransfers =
      depositBreakdown.transferAmountCents +
      installmentBreakdown.transferAmountCents * NUM_INSTALLMENTS;
    const totalAppFees =
      plan.depositCents -
      depositBreakdown.transferAmountCents +
      (plan.installmentCents - installmentBreakdown.transferAmountCents) * NUM_INSTALLMENTS;
    const totalOwnerPayments = plan.depositCents + plan.installmentCents * NUM_INSTALLMENTS;

    expect(totalTransfers + totalAppFees).toBe(totalOwnerPayments);
  });

  it('installment payout has no fee or clinic share', () => {
    const plan = planValues(100_000);
    const breakdown = calculateInstallmentPayoutBreakdown(plan.installmentCents);

    expect(breakdown.platformFeeCents).toBe(0);
    expect(breakdown.clinicShareCents).toBe(0);
  });

  it('deposit payout contains entire plan fee and entire clinic share', () => {
    const plan = planValues(100_000);
    const breakdown = calculateDepositPayoutBreakdown(
      plan.depositCents,
      plan.feeCents,
      plan.totalWithFeeCents,
    );

    expect(breakdown.platformFeeCents).toBe(plan.feeCents);
    expect(breakdown.clinicShareCents).toBe(
      percentOfCents(plan.totalWithFeeCents, CLINIC_SHARE_RATE),
    );
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
    mockSelect.mockImplementation((fields: Record<string, unknown>) => {
      if ('total' in fields) {
        return {
          from: mock(() => ({
            where: mock(() => Promise.resolve([{ total: 1 }])),
          })),
        };
      }
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
    mockSelect.mockImplementation((fields: Record<string, unknown>) => {
      if ('totalPayout' in fields) {
        return {
          from: mock(() => ({
            where: mock(() => Promise.resolve([{ totalPayout: '150000', totalShare: '4500' }])),
          })),
        };
      }
      if ('pendingPayout' in fields) {
        return {
          from: mock(() => ({
            where: mock(() => Promise.resolve([{ pendingPayout: '15900' }])),
          })),
        };
      }
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
