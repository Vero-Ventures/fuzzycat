import { afterEach, beforeEach, describe, expect, it, mock } from 'bun:test';

// ── Mocks ────────────────────────────────────────────────────────────

mock.module('@/lib/logger', () => ({
  logger: {
    info: mock(),
    warn: mock(),
    error: mock(),
  },
}));

// DB mock setup
const mockSelectLimit = mock();
const mockSelectWhere = mock();
const mockSelectFrom = mock();
const mockSelectGroupBy = mock();
const mockSelect = mock();
const mockUpdateSet = mock();
const mockUpdateWhere = mock();
const mockUpdate = mock();
const mockInsertValues = mock();
const mockInsert = mock();

// Transaction mock
const mockTxSelectLimit = mock();
const mockTxSelectWhere = mock();
const mockTxSelectFrom = mock();
const mockTxSelect = mock();
const mockTxUpdateSet = mock();
const mockTxUpdateWhere = mock();
const mockTxUpdate = mock();
const mockTxInsertValues = mock();
const mockTxInsert = mock();

const mockTransaction = mock(async (fn: (tx: Record<string, unknown>) => Promise<unknown>) => {
  const tx = {
    select: mockTxSelect,
    update: mockTxUpdate,
    insert: mockTxInsert,
  };
  mockTxSelectLimit.mockReturnValue([]);
  mockTxSelectWhere.mockReturnValue({ limit: mockTxSelectLimit });
  mockTxSelectFrom.mockReturnValue({ where: mockTxSelectWhere });
  mockTxSelect.mockReturnValue({ from: mockTxSelectFrom });

  mockTxUpdateWhere.mockResolvedValue([]);
  mockTxUpdateSet.mockReturnValue({ where: mockTxUpdateWhere });
  mockTxUpdate.mockReturnValue({ set: mockTxUpdateSet });

  mockTxInsertValues.mockResolvedValue([]);
  mockTxInsert.mockReturnValue({ values: mockTxInsertValues });

  return fn(tx);
});

mock.module('@/server/db', () => ({
  db: {
    select: mockSelect,
    update: mockUpdate,
    insert: mockInsert,
    transaction: mockTransaction,
  },
}));

mock.module('@/server/db/schema', () => ({
  owners: { id: 'owners.id' },
  clinics: { id: 'clinics.id' },
  plans: {
    id: 'plans.id',
    status: 'plans.status',
    remainingCents: 'plans.remaining_cents',
    clinicId: 'plans.clinic_id',
  },
  payments: {
    id: 'payments.id',
    planId: 'payments.plan_id',
    amountCents: 'payments.amount_cents',
    status: 'payments.status',
    type: 'payments.type',
    retryCount: 'payments.retry_count',
    scheduledAt: 'payments.scheduled_at',
    sequenceNum: 'payments.sequence_num',
    failureReason: 'payments.failure_reason',
  },
  payouts: { id: 'payouts.id' },
  auditLog: { id: 'auditLog.id' },
  riskPool: { id: 'riskPool.id' },
  clinicStatusEnum: {},
  paymentMethodEnum: {},
  planStatusEnum: {},
  paymentTypeEnum: {},
  paymentStatusEnum: {},
  payoutStatusEnum: {},
  riskPoolTypeEnum: {},
  actorTypeEnum: {},
  clinicsRelations: {},
  ownersRelations: {},
  plansRelations: {},
  paymentsRelations: {},
  payoutsRelations: {},
  riskPoolRelations: {},
}));

mock.module('drizzle-orm', () => ({
  eq: (col: string, val: unknown) => ({ col, val, type: 'eq' }),
  and: (...args: unknown[]) => ({ args, type: 'and' }),
  lte: (col: string, val: unknown) => ({ col, val, type: 'lte' }),
  inArray: (col: string, vals: unknown[]) => ({ col, vals, type: 'inArray' }),
  sql: (strings: TemplateStringsArray, ...values: unknown[]) => ({
    strings: [...strings],
    values,
    type: 'sql',
  }),
}));

const {
  identifyDuePayments,
  retryFailedPayment,
  escalateDefault,
  identifyPlansForEscalation,
  getRetrySuccessRate,
} = await import('@/server/services/collection');

const { isLikelyPayday } = await import('@/lib/utils/payday');

// ── Helpers ──────────────────────────────────────────────────────────

function setupSelectChain() {
  mockSelectLimit.mockReturnValue([]);
  mockSelectGroupBy.mockReturnValue([]);
  mockSelectWhere.mockReturnValue({
    limit: mockSelectLimit,
    groupBy: mockSelectGroupBy,
  });
  mockSelectFrom.mockReturnValue({
    where: mockSelectWhere,
    groupBy: mockSelectGroupBy,
  });
  mockSelect.mockReturnValue({ from: mockSelectFrom });
}

function clearAllMocks() {
  for (const m of [
    mockSelect,
    mockSelectFrom,
    mockSelectWhere,
    mockSelectLimit,
    mockSelectGroupBy,
    mockUpdate,
    mockUpdateSet,
    mockUpdateWhere,
    mockInsert,
    mockInsertValues,
    mockTxSelect,
    mockTxSelectFrom,
    mockTxSelectWhere,
    mockTxSelectLimit,
    mockTxUpdate,
    mockTxUpdateSet,
    mockTxUpdateWhere,
    mockTxInsert,
    mockTxInsertValues,
    mockTransaction,
  ]) {
    m.mockClear();
  }
}

// ── Tests: identifyDuePayments ───────────────────────────────────────

describe('identifyDuePayments', () => {
  beforeEach(setupSelectChain);
  afterEach(clearAllMocks);

  it('returns due payments that are pending and scheduled before now', async () => {
    const duePayment = {
      id: 'pay-1',
      planId: 'plan-1',
      amountCents: 15_900,
      scheduledAt: new Date('2026-02-20'),
      sequenceNum: 1,
    };

    mockSelectWhere.mockReturnValueOnce([duePayment]);

    const result = await identifyDuePayments();

    expect(result).toEqual([duePayment]);
    expect(mockSelect).toHaveBeenCalledTimes(1);
  });

  it('returns empty array when no payments are due', async () => {
    mockSelectWhere.mockReturnValueOnce([]);

    const result = await identifyDuePayments();

    expect(result).toEqual([]);
  });

  it('returns multiple due payments', async () => {
    const duePayments = [
      {
        id: 'pay-1',
        planId: 'plan-1',
        amountCents: 15_900,
        scheduledAt: new Date('2026-02-18'),
        sequenceNum: 1,
      },
      {
        id: 'pay-2',
        planId: 'plan-2',
        amountCents: 20_000,
        scheduledAt: new Date('2026-02-19'),
        sequenceNum: 2,
      },
    ];

    mockSelectWhere.mockReturnValueOnce(duePayments);

    const result = await identifyDuePayments();

    expect(result).toHaveLength(2);
  });
});

// ── Tests: retryFailedPayment ────────────────────────────────────────

describe('retryFailedPayment', () => {
  afterEach(clearAllMocks);

  it('retries a failed payment and increments retry count', async () => {
    mockTxSelectLimit.mockResolvedValueOnce([
      { id: 'pay-1', status: 'failed', retryCount: 0, planId: 'plan-1', amountCents: 15_900 },
    ]);

    const result = await retryFailedPayment('pay-1');

    expect(result).toBe(true);

    // Verify status updated to 'retried' with incremented count
    expect(mockTxUpdateSet).toHaveBeenCalledWith(
      expect.objectContaining({
        status: 'retried',
        retryCount: 1,
        failureReason: null,
      }),
    );
  });

  it('creates audit log when retrying', async () => {
    mockTxSelectLimit.mockResolvedValueOnce([
      { id: 'pay-1', status: 'failed', retryCount: 1, planId: 'plan-1', amountCents: 15_900 },
    ]);

    await retryFailedPayment('pay-1');

    expect(mockTxInsertValues).toHaveBeenCalledWith(
      expect.objectContaining({
        entityType: 'payment',
        entityId: 'pay-1',
        action: 'retried',
        actorType: 'system',
      }),
    );
  });

  it('includes urgencyLevel in audit log', async () => {
    mockTxSelectLimit.mockResolvedValueOnce([
      { id: 'pay-1', status: 'failed', retryCount: 1, planId: 'plan-1', amountCents: 15_900 },
    ]);

    await retryFailedPayment('pay-1');

    const auditCall = mockTxInsertValues.mock.calls[0][0] as Record<string, unknown>;
    const newValue = JSON.parse(auditCall.newValue as string) as { urgencyLevel: number };
    expect(newValue.urgencyLevel).toBe(2);
  });

  it('returns false when payment has exhausted retries', async () => {
    mockTxSelectLimit.mockResolvedValueOnce([
      { id: 'pay-1', status: 'failed', retryCount: 3, planId: 'plan-1', amountCents: 15_900 },
    ]);

    const result = await retryFailedPayment('pay-1');

    expect(result).toBe(false);
    expect(mockTxUpdateSet).not.toHaveBeenCalled();
  });

  it('returns false when payment is not in failed status', async () => {
    mockTxSelectLimit.mockResolvedValueOnce([
      { id: 'pay-1', status: 'succeeded', retryCount: 0, planId: 'plan-1', amountCents: 15_900 },
    ]);

    const result = await retryFailedPayment('pay-1');

    expect(result).toBe(false);
    expect(mockTxUpdateSet).not.toHaveBeenCalled();
  });

  it('throws when payment is not found', async () => {
    mockTxSelectLimit.mockResolvedValueOnce([]);

    await expect(retryFailedPayment('pay-missing')).rejects.toThrow(
      'Payment not found: pay-missing',
    );
  });

  it('schedules retry on a likely payday instead of fixed 3-day interval', async () => {
    mockTxSelectLimit.mockResolvedValueOnce([
      { id: 'pay-1', status: 'failed', retryCount: 0, planId: 'plan-1', amountCents: 15_900 },
    ]);

    await retryFailedPayment('pay-1');

    const setCall = mockTxUpdateSet.mock.calls[0][0] as { scheduledAt: Date };
    const scheduledAt = setCall.scheduledAt;

    // The scheduled date must be a likely payday (Friday, 1st, or 15th)
    expect(isLikelyPayday(scheduledAt)).toBe(true);
  });

  it('schedules retry at least 2 days in the future', async () => {
    const beforeCall = new Date();

    mockTxSelectLimit.mockResolvedValueOnce([
      { id: 'pay-1', status: 'failed', retryCount: 0, planId: 'plan-1', amountCents: 15_900 },
    ]);

    await retryFailedPayment('pay-1');

    const setCall = mockTxUpdateSet.mock.calls[0][0] as { scheduledAt: Date };
    const scheduledAt = setCall.scheduledAt;
    const diffMs = scheduledAt.getTime() - beforeCall.getTime();
    const diffDays = diffMs / (1000 * 60 * 60 * 24);

    // Should be at least 2 days in the future (payday alignment with min 2-day gap)
    expect(diffDays).toBeGreaterThanOrEqual(1.9);
  });

  it('sets urgency level 1 for first retry', async () => {
    mockTxSelectLimit.mockResolvedValueOnce([
      { id: 'pay-1', status: 'failed', retryCount: 0, planId: 'plan-1', amountCents: 15_900 },
    ]);

    await retryFailedPayment('pay-1');

    const auditCall = mockTxInsertValues.mock.calls[0][0] as Record<string, unknown>;
    const newValue = JSON.parse(auditCall.newValue as string) as { urgencyLevel: number };
    expect(newValue.urgencyLevel).toBe(1);
  });

  it('sets urgency level 2 for second retry', async () => {
    mockTxSelectLimit.mockResolvedValueOnce([
      { id: 'pay-1', status: 'failed', retryCount: 1, planId: 'plan-1', amountCents: 15_900 },
    ]);

    await retryFailedPayment('pay-1');

    const auditCall = mockTxInsertValues.mock.calls[0][0] as Record<string, unknown>;
    const newValue = JSON.parse(auditCall.newValue as string) as { urgencyLevel: number };
    expect(newValue.urgencyLevel).toBe(2);
  });

  it('sets urgency level 3 for third retry', async () => {
    mockTxSelectLimit.mockResolvedValueOnce([
      { id: 'pay-1', status: 'failed', retryCount: 2, planId: 'plan-1', amountCents: 15_900 },
    ]);

    await retryFailedPayment('pay-1');

    const auditCall = mockTxInsertValues.mock.calls[0][0] as Record<string, unknown>;
    const newValue = JSON.parse(auditCall.newValue as string) as { urgencyLevel: number };
    expect(newValue.urgencyLevel).toBe(3);
  });
});

// ── Tests: escalateDefault ───────────────────────────────────────────

describe('escalateDefault', () => {
  afterEach(clearAllMocks);

  it('marks plan as defaulted and creates risk pool claim', async () => {
    // First tx select: fetch plan
    mockTxSelectLimit.mockResolvedValueOnce([
      { id: 'plan-1', status: 'active', remainingCents: 60_000, clinicId: 'clinic-1' },
    ]);

    // Second tx select: unpaid payments sum
    mockTxSelectWhere
      .mockReturnValueOnce({ limit: mockTxSelectLimit }) // plan query
      .mockReturnValueOnce([{ totalUnpaidCents: 45_000 }]); // unpaid sum query

    await escalateDefault('plan-1');

    // Verify plan status updated to defaulted
    expect(mockTxUpdateSet).toHaveBeenCalledWith(expect.objectContaining({ status: 'defaulted' }));

    // Verify risk pool claim created
    const insertCalls = mockTxInsertValues.mock.calls;
    const riskPoolClaim = insertCalls.find((call: unknown[]) => {
      const arg = call[0] as Record<string, unknown>;
      return arg.type === 'claim';
    });
    expect(riskPoolClaim).toBeTruthy();
  });

  it('skips when plan is already defaulted', async () => {
    mockTxSelectLimit.mockResolvedValueOnce([
      { id: 'plan-1', status: 'defaulted', remainingCents: 60_000, clinicId: 'clinic-1' },
    ]);

    await escalateDefault('plan-1');

    expect(mockTxUpdateSet).not.toHaveBeenCalled();
  });

  it('throws when plan is not in active status', async () => {
    mockTxSelectLimit.mockResolvedValueOnce([
      { id: 'plan-1', status: 'pending', remainingCents: 60_000, clinicId: 'clinic-1' },
    ]);

    await expect(escalateDefault('plan-1')).rejects.toThrow(
      'Cannot default plan in status: pending',
    );
  });

  it('throws when plan is not found', async () => {
    mockTxSelectLimit.mockResolvedValueOnce([]);

    await expect(escalateDefault('plan-missing')).rejects.toThrow('Plan not found: plan-missing');
  });

  it('creates audit log entries for plan default and payment write-off', async () => {
    mockTxSelectLimit.mockResolvedValueOnce([
      { id: 'plan-1', status: 'active', remainingCents: 60_000, clinicId: 'clinic-1' },
    ]);

    mockTxSelectWhere
      .mockReturnValueOnce({ limit: mockTxSelectLimit })
      .mockReturnValueOnce([{ totalUnpaidCents: 45_000 }]);

    await escalateDefault('plan-1');

    const auditCalls = mockTxInsertValues.mock.calls.filter((call: unknown[]) => {
      const arg = call[0] as Record<string, unknown>;
      return arg.entityType === 'plan';
    });

    // Should have audit entries for plan status change and payments written off
    expect(auditCalls.length).toBeGreaterThanOrEqual(2);
  });

  it('writes off remaining unpaid payments', async () => {
    mockTxSelectLimit.mockResolvedValueOnce([
      { id: 'plan-1', status: 'active', remainingCents: 60_000, clinicId: 'clinic-1' },
    ]);

    mockTxSelectWhere
      .mockReturnValueOnce({ limit: mockTxSelectLimit })
      .mockReturnValueOnce([{ totalUnpaidCents: 45_000 }]);

    await escalateDefault('plan-1');

    // Verify payments are written off (second update call)
    const updateCalls = mockTxUpdateSet.mock.calls;
    const writeOffCall = updateCalls.find((call: unknown[]) => {
      const arg = call[0] as Record<string, unknown>;
      return arg.status === 'written_off';
    });
    expect(writeOffCall).toBeTruthy();
  });
});

// ── Tests: identifyPlansForEscalation ────────────────────────────────

describe('identifyPlansForEscalation', () => {
  beforeEach(setupSelectChain);
  afterEach(clearAllMocks);

  it('returns active plan IDs that have written-off payments', async () => {
    // First select: get plans with written_off payments
    mockSelectGroupBy.mockReturnValueOnce([{ planId: 'plan-1' }, { planId: 'plan-2' }]);

    // Re-setup select chain for subsequent plan status lookups
    // Plan-1: active
    mockSelectLimit
      .mockResolvedValueOnce([{ status: 'active' }])
      // Plan-2: already defaulted
      .mockResolvedValueOnce([{ status: 'defaulted' }]);

    const result = await identifyPlansForEscalation();

    expect(result).toEqual(['plan-1']);
  });

  it('returns empty array when no plans have written-off payments', async () => {
    mockSelectGroupBy.mockReturnValueOnce([]);

    const result = await identifyPlansForEscalation();

    expect(result).toEqual([]);
  });
});

// ── Tests: getRetrySuccessRate ───────────────────────────────────────

describe('getRetrySuccessRate', () => {
  beforeEach(setupSelectChain);
  afterEach(clearAllMocks);

  it('calculates correct rate when there are retried and succeeded payments', async () => {
    // First select: count all retried (retryCount > 0)
    mockSelectFrom.mockReturnValueOnce({
      where: mock().mockReturnValueOnce([{ total: 10 }]),
      groupBy: mockSelectGroupBy,
    });

    // Second select: count succeeded among retried
    mockSelectFrom.mockReturnValueOnce({
      where: mock().mockReturnValueOnce([{ succeeded: 7 }]),
      groupBy: mockSelectGroupBy,
    });

    const result = await getRetrySuccessRate();

    expect(result.total).toBe(10);
    expect(result.succeeded).toBe(7);
    expect(result.rate).toBeCloseTo(0.7);
  });

  it('returns zero rate when no payments have been retried', async () => {
    mockSelectFrom.mockReturnValueOnce({
      where: mock().mockReturnValueOnce([{ total: 0 }]),
      groupBy: mockSelectGroupBy,
    });

    mockSelectFrom.mockReturnValueOnce({
      where: mock().mockReturnValueOnce([{ succeeded: 0 }]),
      groupBy: mockSelectGroupBy,
    });

    const result = await getRetrySuccessRate();

    expect(result.total).toBe(0);
    expect(result.succeeded).toBe(0);
    expect(result.rate).toBe(0);
  });

  it('handles case where all retries succeeded', async () => {
    mockSelectFrom.mockReturnValueOnce({
      where: mock().mockReturnValueOnce([{ total: 5 }]),
      groupBy: mockSelectGroupBy,
    });

    mockSelectFrom.mockReturnValueOnce({
      where: mock().mockReturnValueOnce([{ succeeded: 5 }]),
      groupBy: mockSelectGroupBy,
    });

    const result = await getRetrySuccessRate();

    expect(result.total).toBe(5);
    expect(result.succeeded).toBe(5);
    expect(result.rate).toBe(1);
  });

  it('handles case where no retries succeeded', async () => {
    mockSelectFrom.mockReturnValueOnce({
      where: mock().mockReturnValueOnce([{ total: 3 }]),
      groupBy: mockSelectGroupBy,
    });

    mockSelectFrom.mockReturnValueOnce({
      where: mock().mockReturnValueOnce([{ succeeded: 0 }]),
      groupBy: mockSelectGroupBy,
    });

    const result = await getRetrySuccessRate();

    expect(result.total).toBe(3);
    expect(result.succeeded).toBe(0);
    expect(result.rate).toBe(0);
  });
});
