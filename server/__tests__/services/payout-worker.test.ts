import { afterEach, beforeEach, describe, expect, it, mock } from 'bun:test';

// ── Mocks ────────────────────────────────────────────────────────────

const mockTransfersCreate = mock(() => Promise.resolve({ id: 'tr_worker_123' }));

mock.module('@/lib/stripe', () => ({
  stripe: () => ({
    transfers: { create: mockTransfersCreate },
  }),
}));

const mockLogger = {
  info: mock(),
  warn: mock(),
  error: mock(),
};

mock.module('@/lib/logger', () => ({
  logger: mockLogger,
}));

import { schemaMock } from '../stripe/_mock-schema';

mock.module('@/server/db/schema', () => schemaMock);

// ── DB mock ──────────────────────────────────────────────────────────

const mockSelect = mock();
const mockInsert = mock();
const mockUpdate = mock();
const mockTransaction = mock();

mock.module('@/server/db', () => ({
  db: {
    select: mockSelect,
    insert: mockInsert,
    update: mockUpdate,
    transaction: mockTransaction,
    query: {
      payments: { findFirst: mock() },
      payouts: { findFirst: mock() },
    },
  },
}));

const { processPendingPayouts } = await import('@/server/services/payout');

// ── Helpers ──────────────────────────────────────────────────────────

const pendingPayout = {
  id: 'payout-1',
  clinicId: 'clinic-1',
  planId: 'plan-1',
  paymentId: 'pay-1',
  amountCents: 15_000,
  clinicShareCents: 477,
};

function setupSelectMocks(
  pendingPayouts: (typeof pendingPayout)[],
  clinicData?: { stripeAccountId: string | null },
) {
  let selectCallCount = 0;
  mockSelect.mockImplementation(() => {
    selectCallCount++;
    const callNum = selectCallCount;
    if (callNum === 1) {
      // Pending payouts query
      return {
        from: mock(() => ({
          where: mock(() => Promise.resolve(pendingPayouts)),
        })),
      };
    }
    // Clinic lookup query
    return {
      from: mock(() => ({
        where: mock(() => ({
          limit: mock(() =>
            Promise.resolve(clinicData ? [clinicData] : [{ stripeAccountId: 'acct_clinic_123' }]),
          ),
        })),
      })),
    };
  });
}

function setupTransactionMock() {
  mockTransaction.mockImplementation(async (fn: (tx: unknown) => Promise<void>) => {
    const txMock = {
      update: mock(() => ({
        set: mock(() => ({
          where: mock(() => Promise.resolve([])),
        })),
      })),
      insert: mock(() => ({
        values: mock(() => Promise.resolve([])),
      })),
    };
    return fn(txMock);
  });
}

// ── Tests ────────────────────────────────────────────────────────────

describe('processPendingPayouts', () => {
  beforeEach(() => {
    setupSelectMocks([pendingPayout]);
    setupTransactionMock();
    mockTransfersCreate.mockResolvedValue({ id: 'tr_worker_123' });
  });

  afterEach(() => {
    mockSelect.mockClear();
    mockInsert.mockClear();
    mockUpdate.mockClear();
    mockTransaction.mockClear();
    mockTransfersCreate.mockClear();
    mockLogger.info.mockClear();
    mockLogger.warn.mockClear();
    mockLogger.error.mockClear();
  });

  it('processes pending payouts and returns a summary', async () => {
    const result = await processPendingPayouts();

    expect(result.processed).toBe(1);
    expect(result.succeeded).toBe(1);
    expect(result.failed).toBe(0);
    expect(result.results).toHaveLength(1);
    expect(result.results[0].payoutId).toBe('payout-1');
    expect(result.results[0].status).toBe('succeeded');
    expect(result.results[0].stripeTransferId).toBe('tr_worker_123');
  });

  it('uses Stripe idempotency key based on payout ID', async () => {
    await processPendingPayouts();

    expect(mockTransfersCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        amount: 15_000,
        currency: 'usd',
        destination: 'acct_clinic_123',
      }),
      { idempotencyKey: 'payout_payout-1' },
    );
  });

  it('includes metadata in Stripe transfer', async () => {
    await processPendingPayouts();

    expect(mockTransfersCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        metadata: {
          payoutId: 'payout-1',
          paymentId: 'pay-1',
          planId: 'plan-1',
          clinicId: 'clinic-1',
        },
      }),
      expect.any(Object),
    );
  });

  it('returns empty results when no pending payouts exist', async () => {
    setupSelectMocks([]);

    const result = await processPendingPayouts();

    expect(result.processed).toBe(0);
    expect(result.succeeded).toBe(0);
    expect(result.failed).toBe(0);
    expect(result.results).toHaveLength(0);
  });

  it('marks payout as failed when Stripe transfer fails', async () => {
    mockTransfersCreate.mockRejectedValue(new Error('Stripe API error'));

    const result = await processPendingPayouts();

    expect(result.processed).toBe(1);
    expect(result.succeeded).toBe(0);
    expect(result.failed).toBe(1);
    expect(result.results[0].status).toBe('failed');
    expect(result.results[0].error).toBe('Stripe API error');
  });

  it('marks payout as failed when clinic has no Stripe account', async () => {
    setupSelectMocks([pendingPayout], { stripeAccountId: null });

    const result = await processPendingPayouts();

    expect(result.processed).toBe(1);
    expect(result.failed).toBe(1);
    expect(result.results[0].error).toContain('no Stripe Connect account');
  });

  it('processes multiple payouts independently', async () => {
    const payout2 = { ...pendingPayout, id: 'payout-2', paymentId: 'pay-2' };

    let selectCallCount = 0;
    mockSelect.mockImplementation(() => {
      selectCallCount++;
      if (selectCallCount === 1) {
        return {
          from: mock(() => ({
            where: mock(() => Promise.resolve([pendingPayout, payout2])),
          })),
        };
      }
      return {
        from: mock(() => ({
          where: mock(() => ({
            limit: mock(() => Promise.resolve([{ stripeAccountId: 'acct_clinic_123' }])),
          })),
        })),
      };
    });

    // First succeeds, second fails
    mockTransfersCreate
      .mockResolvedValueOnce({ id: 'tr_worker_123' })
      .mockRejectedValueOnce(new Error('Rate limited'));

    const result = await processPendingPayouts();

    expect(result.processed).toBe(2);
    expect(result.succeeded).toBe(1);
    expect(result.failed).toBe(1);
  });

  it('logs error when payout has no clinic ID', async () => {
    setupSelectMocks([{ ...pendingPayout, clinicId: null as unknown as string }]);

    const result = await processPendingPayouts();

    expect(result.failed).toBe(1);
    expect(result.results[0].error).toContain('no clinic ID');
  });

  it('logs completion summary', async () => {
    await processPendingPayouts();

    expect(mockLogger.info).toHaveBeenCalledWith(
      'Pending payouts processing complete',
      expect.objectContaining({
        processed: 1,
        succeeded: 1,
        failed: 0,
      }),
    );
  });
});
