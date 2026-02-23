import { afterEach, beforeEach, describe, expect, it, mock } from 'bun:test';
import { CLINIC_SHARE_RATE, PLATFORM_FEE_RATE, PLATFORM_RESERVE_RATE } from '@/lib/constants';
import { percentOfCents } from '@/lib/utils/money';

// ── Mocks ────────────────────────────────────────────────────────────
// Instead of mocking @/server/services/stripe/connect (which leaks into
// connect.test.ts due to Bun's global mock.module scope), we mock the
// underlying dependencies: @/lib/stripe and @/server/db. This lets
// transferToClinic run its real logic against mocked Stripe + DB.

const mockTransfersCreate = mock(() => Promise.resolve({ id: 'tr_payout_789' }));

mock.module('@/lib/stripe', () => ({
  stripe: () => ({
    accounts: { create: mock() },
    accountLinks: { create: mock() },
    transfers: { create: mockTransfersCreate },
  }),
}));

import { schemaMock } from './stripe/_mock-schema';

mock.module('@/server/db/schema', () => schemaMock);

// ── DB mock: superset of all methods used by payout.ts + connect.ts ──

const mockFindFirstPayments = mock();
const mockFindFirstPayouts = mock();

const mockSelect = mock();
const mockUpdate = mock();
const mockInsert = mock();

const mockTransaction = mock(async (fn: (tx: unknown) => Promise<unknown>) => {
  const tx = { update: mockUpdate, insert: mockInsert };
  return fn(tx);
});

mock.module('@/server/db', () => ({
  db: {
    query: {
      payments: { findFirst: mockFindFirstPayments },
      payouts: { findFirst: mockFindFirstPayouts },
    },
    select: mockSelect,
    update: mockUpdate,
    insert: mockInsert,
    transaction: mockTransaction,
  },
}));

const { calculatePayoutBreakdown, processClinicPayout, getClinicPayoutHistory, getClinicEarnings } =
  await import('@/server/services/payout');

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

// ── processClinicPayout tests ────────────────────────────────────────

describe('processClinicPayout', () => {
  const validPayment = {
    id: 'pay-1',
    planId: 'plan-1',
    type: 'installment' as const,
    sequenceNum: 1,
    amountCents: 15_900,
    status: 'succeeded' as const,
    stripePaymentIntentId: 'pi_123',
    failureReason: null,
    retryCount: 0,
    scheduledAt: new Date(),
    processedAt: new Date(),
    createdAt: new Date(),
    updatedAt: new Date(),
    plan: {
      id: 'plan-1',
      ownerId: 'owner-1',
      clinicId: 'clinic-1',
      totalBillCents: 120_000,
      feeCents: 7_200,
      totalWithFeeCents: 127_200,
      depositCents: 31_800,
      remainingCents: 95_400,
      installmentCents: 15_900,
      numInstallments: 6,
      status: 'active' as const,
      depositPaidAt: new Date(),
      nextPaymentAt: new Date(),
      completedAt: null,
      createdAt: new Date(),
      updatedAt: new Date(),
      clinic: {
        id: 'clinic-1',
        authId: null,
        name: 'Happy Paws Vet',
        phone: '555-0100',
        email: 'clinic@example.com',
        addressLine1: '123 Main St',
        addressCity: 'San Francisco',
        addressState: 'CA',
        addressZip: '94102',
        stripeAccountId: 'acct_clinic_123',
        status: 'active' as const,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    },
  };

  beforeEach(() => {
    mockFindFirstPayments.mockResolvedValue(validPayment);
    mockFindFirstPayouts.mockResolvedValue(null); // No existing payout
    mockTransfersCreate.mockResolvedValue({ id: 'tr_payout_789' });

    // Mock insert chain for transferToClinic (called by processClinicPayout):
    //   1st call: db.insert(payouts).values(...).returning() -> payout record
    //   2nd call: db.insert(auditLog).values(...) -> void
    let insertCallCount = 0;
    mockInsert.mockImplementation(() => {
      insertCallCount++;
      const callNum = insertCallCount;
      if (callNum === 1) {
        // Payout record insert with returning()
        return {
          values: mock(() => ({
            returning: mock(() => Promise.resolve([{ id: 'payout-mock-1' }])),
          })),
        };
      }
      // Audit log insert without returning()
      return {
        values: mock(() => Promise.resolve([])),
      };
    });
  });

  afterEach(() => {
    mockFindFirstPayments.mockClear();
    mockFindFirstPayouts.mockClear();
    mockTransfersCreate.mockClear();
    mockInsert.mockClear();
  });

  it('processes a payout for a succeeded payment', async () => {
    const result = await processClinicPayout('pay-1');

    expect(result.payoutId).toBe('payout-mock-1');
    expect(result.stripeTransferId).toBe('tr_payout_789');
    expect(result.breakdown.paymentAmountCents).toBe(15_900);
  });

  it('calls transferToClinic with correct parameters via Stripe', async () => {
    await processClinicPayout('pay-1');

    const breakdown = calculatePayoutBreakdown(15_900);

    // Verify the Stripe transfer was called with the right amount and destination
    expect(mockTransfersCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        amount: breakdown.transferAmountCents,
        currency: 'usd',
        destination: 'acct_clinic_123',
        metadata: expect.objectContaining({
          paymentId: 'pay-1',
          planId: 'plan-1',
          clinicId: 'clinic-1',
        }),
      }),
    );
  });

  it('returns the correct payout breakdown', async () => {
    const result = await processClinicPayout('pay-1');

    expect(result.breakdown.paymentAmountCents).toBe(15_900);
    expect(result.breakdown.clinicShareCents).toBe(percentOfCents(15_900, CLINIC_SHARE_RATE));
    expect(result.breakdown.platformFeeCents).toBeGreaterThan(0);
    expect(result.breakdown.riskPoolCents).toBeGreaterThan(0);
    expect(result.breakdown.transferAmountCents).toBeGreaterThan(0);
  });

  it('throws when payment is not found', async () => {
    mockFindFirstPayments.mockResolvedValue(null);

    await expect(processClinicPayout('pay-nonexistent')).rejects.toThrow(
      'Payment not found: pay-nonexistent',
    );
  });

  it('throws when payment is not succeeded', async () => {
    mockFindFirstPayments.mockResolvedValue({
      ...validPayment,
      status: 'pending',
    });

    await expect(processClinicPayout('pay-1')).rejects.toThrow(
      'Payment pay-1 is not succeeded (status: pending)',
    );
  });

  it('throws when payment has no plan', async () => {
    mockFindFirstPayments.mockResolvedValue({
      ...validPayment,
      plan: null,
    });

    await expect(processClinicPayout('pay-1')).rejects.toThrow(
      'Payment pay-1 has no associated plan',
    );
  });

  it('throws when plan is not in a payable state', async () => {
    mockFindFirstPayments.mockResolvedValue({
      ...validPayment,
      plan: {
        ...validPayment.plan,
        status: 'cancelled',
      },
    });

    await expect(processClinicPayout('pay-1')).rejects.toThrow(
      'Plan plan-1 is not in a payable state (status: cancelled)',
    );
  });

  it('allows payout for deposit_paid plan status', async () => {
    mockFindFirstPayments.mockResolvedValue({
      ...validPayment,
      plan: {
        ...validPayment.plan,
        status: 'deposit_paid',
      },
    });

    const result = await processClinicPayout('pay-1');
    expect(result.payoutId).toBe('payout-mock-1');
  });

  it('throws when clinic has no Stripe Connect account', async () => {
    mockFindFirstPayments.mockResolvedValue({
      ...validPayment,
      plan: {
        ...validPayment.plan,
        clinic: {
          ...validPayment.plan.clinic,
          stripeAccountId: null,
        },
      },
    });

    await expect(processClinicPayout('pay-1')).rejects.toThrow(
      'Clinic clinic-1 does not have a Stripe Connect account',
    );
  });

  it('throws when a payout already exists for the payment', async () => {
    mockFindFirstPayouts.mockResolvedValue({ id: 'existing-payout-1' });

    await expect(processClinicPayout('pay-1')).rejects.toThrow(
      'Payout already exists for payment pay-1: existing-payout-1',
    );
  });

  it('throws when plan has no clinic', async () => {
    mockFindFirstPayments.mockResolvedValue({
      ...validPayment,
      plan: {
        ...validPayment.plan,
        clinic: null,
      },
    });

    await expect(processClinicPayout('pay-1')).rejects.toThrow(
      'Plan plan-1 has no associated clinic',
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
