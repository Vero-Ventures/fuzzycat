import { afterEach, beforeEach, describe, expect, it, mock } from 'bun:test';

// ── Mocks ────────────────────────────────────────────────────────────

const mockCheckoutSessionsCreate = mock(() =>
  Promise.resolve({
    id: 'cs_test_session_123',
    url: 'https://checkout.stripe.com/pay/cs_test_session_123',
    payment_intent: 'pi_deposit_456',
  }),
);

const mockPaymentIntentsCreate = mock(() =>
  Promise.resolve({
    id: 'pi_ach_789',
    client_secret: 'pi_ach_789_secret_abc',
    status: 'requires_confirmation',
  }),
);

const mockTransfersCreate = mock(() => Promise.resolve({ id: 'tr_transfer_789' }));

mock.module('@/lib/stripe', () => ({
  stripe: () => ({
    checkout: { sessions: { create: mockCheckoutSessionsCreate } },
    paymentIntents: { create: mockPaymentIntentsCreate },
    transfers: { create: mockTransfersCreate },
  }),
}));

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
const mockSelect = mock();
const mockUpdateSet = mock();
const mockUpdateWhere = mock();
const mockUpdate = mock();
const mockInsertValues = mock();
const mockInsertReturning = mock();
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
const mockTxInsertReturning = mock();
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
  owners: {
    id: 'owners.id',
    stripeCustomerId: 'owners.stripe_customer_id',
  },
  clinics: {
    id: 'clinics.id',
    stripeAccountId: 'clinics.stripe_account_id',
  },
  plans: {
    id: 'plans.id',
    ownerId: 'plans.owner_id',
    clinicId: 'plans.clinic_id',
    depositCents: 'plans.deposit_cents',
    totalBillCents: 'plans.total_bill_cents',
    remainingCents: 'plans.remaining_cents',
    status: 'plans.status',
  },
  payments: {
    id: 'payments.id',
    planId: 'payments.plan_id',
    amountCents: 'payments.amount_cents',
    status: 'payments.status',
    type: 'payments.type',
    retryCount: 'payments.retry_count',
    stripePaymentIntentId: 'payments.stripe_payment_intent_id',
    sequenceNum: 'payments.sequence_num',
    scheduledAt: 'payments.scheduled_at',
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
  softCollections: {
    id: 'soft_collections.id',
    planId: 'soft_collections.plan_id',
    stage: 'soft_collections.stage',
    nextEscalationAt: 'soft_collections.next_escalation_at',
  },
}));

import { createAuditMock } from '../audit-mock';

mock.module('@/server/services/audit', () => createAuditMock(mockInsert));

mock.module('drizzle-orm', () => ({
  eq: (col: string, val: string) => ({ col, val, type: 'eq' }),
  and: (...args: unknown[]) => ({ args, type: 'and' }),
  desc: (col: string) => ({ col, type: 'desc' }),
  lte: (col: string, val: unknown) => ({ col, val, type: 'lte' }),
  inArray: (col: string, vals: unknown[]) => ({ col, vals, type: 'inArray' }),
  sql: (strings: TemplateStringsArray, ...values: unknown[]) => ({
    strings: [...strings],
    values,
    type: 'sql',
  }),
}));

const {
  processDeposit,
  processInstallment,
  handlePaymentSuccess,
  handlePaymentFailure,
  findPaymentByStripeId,
} = await import('@/server/services/payment');

// ── Helpers ──────────────────────────────────────────────────────────

function setupSelectChain() {
  mockSelectLimit.mockReturnValue([]);
  mockSelectWhere.mockReturnValue({ limit: mockSelectLimit });
  mockSelectFrom.mockReturnValue({ where: mockSelectWhere });
  mockSelect.mockReturnValue({ from: mockSelectFrom });
}

function setupUpdateChain() {
  mockUpdateWhere.mockResolvedValue([]);
  mockUpdateSet.mockReturnValue({ where: mockUpdateWhere });
  mockUpdate.mockReturnValue({ set: mockUpdateSet });
}

function setupInsertChain() {
  mockInsertReturning.mockResolvedValue([]);
  mockInsertValues.mockReturnValue({ returning: mockInsertReturning });
  mockInsert.mockReturnValue({ values: mockInsertValues });
}

function clearAllMocks() {
  for (const m of [
    mockSelect,
    mockSelectFrom,
    mockSelectWhere,
    mockSelectLimit,
    mockUpdate,
    mockUpdateSet,
    mockUpdateWhere,
    mockInsert,
    mockInsertValues,
    mockInsertReturning,
    mockTxSelect,
    mockTxSelectFrom,
    mockTxSelectWhere,
    mockTxSelectLimit,
    mockTxUpdate,
    mockTxUpdateSet,
    mockTxUpdateWhere,
    mockTxInsert,
    mockTxInsertValues,
    mockTxInsertReturning,
    mockTransaction,
    mockCheckoutSessionsCreate,
    mockPaymentIntentsCreate,
    mockTransfersCreate,
  ]) {
    m.mockClear();
  }
}

// ── Tests: processDeposit ────────────────────────────────────────────

describe('processDeposit', () => {
  beforeEach(() => {
    setupSelectChain();
    setupUpdateChain();
    setupInsertChain();
  });

  afterEach(clearAllMocks);

  it('throws when plan is not found', async () => {
    // First select returns empty (plan not found)
    mockSelectLimit.mockResolvedValueOnce([]);

    await expect(
      processDeposit({
        planId: 'plan-missing',
        successUrl: 'https://app.example.com/success',
        cancelUrl: 'https://app.example.com/cancel',
      }),
    ).rejects.toThrow('Plan not found: plan-missing');
  });

  it('throws when plan is not in pending status', async () => {
    mockSelectLimit.mockResolvedValueOnce([
      { id: 'plan-1', ownerId: 'owner-1', depositCents: 26_500, status: 'active' },
    ]);

    await expect(
      processDeposit({
        planId: 'plan-1',
        successUrl: 'https://app.example.com/success',
        cancelUrl: 'https://app.example.com/cancel',
      }),
    ).rejects.toThrow('not in pending status');
  });

  it('throws when deposit payment is not found', async () => {
    // First select: plan found
    mockSelectLimit
      .mockResolvedValueOnce([
        { id: 'plan-1', ownerId: 'owner-1', depositCents: 26_500, status: 'pending' },
      ])
      // Second select: deposit payment not found
      .mockResolvedValueOnce([]);

    await expect(
      processDeposit({
        planId: 'plan-1',
        successUrl: 'https://app.example.com/success',
        cancelUrl: 'https://app.example.com/cancel',
      }),
    ).rejects.toThrow('Deposit payment not found');
  });

  it('throws when owner has no Stripe customer ID', async () => {
    mockSelectLimit
      .mockResolvedValueOnce([
        { id: 'plan-1', ownerId: 'owner-1', depositCents: 26_500, status: 'pending' },
      ])
      .mockResolvedValueOnce([{ id: 'pay-1', status: 'pending' }])
      .mockResolvedValueOnce([{ stripeCustomerId: null }]);

    await expect(
      processDeposit({
        planId: 'plan-1',
        successUrl: 'https://app.example.com/success',
        cancelUrl: 'https://app.example.com/cancel',
      }),
    ).rejects.toThrow('does not have a Stripe customer ID');
  });

  it('creates a checkout session for valid deposit', async () => {
    mockSelectLimit
      .mockResolvedValueOnce([
        { id: 'plan-1', ownerId: 'owner-1', depositCents: 26_500, status: 'pending' },
      ])
      .mockResolvedValueOnce([{ id: 'pay-1', status: 'pending' }])
      .mockResolvedValueOnce([{ stripeCustomerId: 'cus_123' }]);

    // Insert chain for audit log is already handled in beforeEach via setupInsertChain()

    const result = await processDeposit({
      planId: 'plan-1',
      successUrl: 'https://app.example.com/success',
      cancelUrl: 'https://app.example.com/cancel',
    });

    expect(result.sessionId).toBe('cs_test_session_123');
    expect(result.sessionUrl).toBe('https://checkout.stripe.com/pay/cs_test_session_123');
    expect(mockCheckoutSessionsCreate).toHaveBeenCalledTimes(1);
  });
});

// ── Tests: processInstallment ────────────────────────────────────────

describe('processInstallment', () => {
  beforeEach(() => {
    setupSelectChain();
    setupUpdateChain();
    setupInsertChain();
  });

  afterEach(clearAllMocks);

  it('throws when payment is not found', async () => {
    mockSelectLimit.mockResolvedValueOnce([]);

    await expect(processInstallment({ paymentId: 'pay-missing' })).rejects.toThrow(
      'Payment not found: pay-missing',
    );
  });

  it('throws when payment is not an installment', async () => {
    mockSelectLimit.mockResolvedValueOnce([
      { id: 'pay-1', planId: 'plan-1', amountCents: 15_900, status: 'pending', type: 'deposit' },
    ]);

    await expect(processInstallment({ paymentId: 'pay-1' })).rejects.toThrow(
      'is not an installment',
    );
  });

  it('throws when payment is not in processable status', async () => {
    mockSelectLimit.mockResolvedValueOnce([
      {
        id: 'pay-1',
        planId: 'plan-1',
        amountCents: 15_900,
        status: 'succeeded',
        type: 'installment',
      },
    ]);

    await expect(processInstallment({ paymentId: 'pay-1' })).rejects.toThrow('cannot be processed');
  });

  it('throws when plan is not active', async () => {
    mockSelectLimit
      .mockResolvedValueOnce([
        {
          id: 'pay-1',
          planId: 'plan-1',
          amountCents: 15_900,
          status: 'pending',
          type: 'installment',
        },
      ])
      .mockResolvedValueOnce([{ ownerId: 'owner-1', status: 'pending' }]);

    await expect(processInstallment({ paymentId: 'pay-1' })).rejects.toThrow('is not active');
  });

  it('creates an ACH payment intent for valid installment', async () => {
    mockSelectLimit
      .mockResolvedValueOnce([
        {
          id: 'pay-2',
          planId: 'plan-1',
          amountCents: 15_900,
          status: 'pending',
          type: 'installment',
        },
      ])
      .mockResolvedValueOnce([{ ownerId: 'owner-1', status: 'active' }])
      .mockResolvedValueOnce([{ stripeCustomerId: 'cus_456' }]);

    // Insert chain for audit log is already handled in beforeEach via setupInsertChain()

    const result = await processInstallment({ paymentId: 'pay-2' });

    expect(result.paymentIntentId).toBe('pi_ach_789');
    expect(result.clientSecret).toBe('pi_ach_789_secret_abc');
    expect(mockPaymentIntentsCreate).toHaveBeenCalledTimes(1);
  });

  it('allows processing retried payments', async () => {
    mockSelectLimit
      .mockResolvedValueOnce([
        {
          id: 'pay-3',
          planId: 'plan-1',
          amountCents: 15_900,
          status: 'retried',
          type: 'installment',
        },
      ])
      .mockResolvedValueOnce([{ ownerId: 'owner-1', status: 'active' }])
      .mockResolvedValueOnce([{ stripeCustomerId: 'cus_456' }]);

    // Insert chain for audit log is already handled in beforeEach via setupInsertChain()

    const result = await processInstallment({ paymentId: 'pay-3' });

    expect(result.paymentIntentId).toBe('pi_ach_789');
  });
});

// ── Tests: handlePaymentSuccess ──────────────────────────────────────

describe('handlePaymentSuccess', () => {
  afterEach(clearAllMocks);

  it('updates payment to succeeded and creates audit log', async () => {
    // Transaction: fetch payment
    mockTxSelectLimit
      .mockResolvedValueOnce([
        {
          id: 'pay-1',
          planId: 'plan-1',
          amountCents: 15_900,
          status: 'processing',
          type: 'installment',
        },
      ])
      // Fetch plan
      .mockResolvedValueOnce([{ id: 'plan-1', clinicId: 'clinic-1', totalBillCents: 120_000 }])
      // Fetch clinic
      .mockResolvedValueOnce([{ stripeAccountId: 'acct_clinic_123' }]);

    await handlePaymentSuccess('pay-1', 'pi_succeeded_123');

    // Verify payment status update
    expect(mockTxUpdateSet).toHaveBeenCalledWith(
      expect.objectContaining({
        status: 'succeeded',
        stripePaymentIntentId: 'pi_succeeded_123',
      }),
    );

    // Verify audit log was created (first insert call)
    expect(mockTxInsertValues).toHaveBeenCalledWith(
      expect.objectContaining({
        entityType: 'payment',
        entityId: 'pay-1',
        action: 'status_changed',
        oldValue: { status: 'processing' },
        newValue: { status: 'succeeded' },
        actorType: 'system',
      }),
    );
  });

  it('skips if payment already succeeded', async () => {
    mockTxSelectLimit.mockResolvedValueOnce([
      {
        id: 'pay-1',
        planId: 'plan-1',
        amountCents: 15_900,
        status: 'succeeded',
        type: 'installment',
      },
    ]);

    await handlePaymentSuccess('pay-1', 'pi_dup_123');

    // Update should NOT have been called
    expect(mockTxUpdateSet).not.toHaveBeenCalled();
  });

  it('creates risk pool contribution', async () => {
    mockTxSelectLimit
      .mockResolvedValueOnce([
        {
          id: 'pay-1',
          planId: 'plan-1',
          amountCents: 10_000,
          status: 'processing',
          type: 'installment',
        },
      ])
      .mockResolvedValueOnce([{ id: 'plan-1', clinicId: 'clinic-1', totalBillCents: 120_000 }])
      .mockResolvedValueOnce([{ stripeAccountId: 'acct_clinic_123' }]);

    await handlePaymentSuccess('pay-1', 'pi_ok_123');

    // Check that risk pool insert was called (1% of 10000 = 100 cents)
    const insertCalls = mockTxInsertValues.mock.calls;
    const riskPoolInsert = insertCalls.find((call: unknown[]) => {
      const arg = call[0] as Record<string, unknown>;
      return arg.type === 'contribution';
    });
    expect(riskPoolInsert).toBeDefined();
    if (!riskPoolInsert) throw new Error('Expected risk pool insert call');
    const riskPoolData = riskPoolInsert[0] as Record<string, unknown>;
    expect(riskPoolData.contributionCents).toBe(100);
  });

  it('throws when payment is not found', async () => {
    mockTxSelectLimit.mockResolvedValueOnce([]);

    await expect(handlePaymentSuccess('pay-missing', 'pi_test')).rejects.toThrow(
      'Payment not found: pay-missing',
    );
  });
});

// ── Tests: handlePaymentFailure ──────────────────────────────────────

describe('handlePaymentFailure', () => {
  afterEach(clearAllMocks);

  it('marks payment as failed with reason and creates audit log', async () => {
    mockTxSelectLimit.mockResolvedValueOnce([
      { id: 'pay-1', status: 'processing', retryCount: 0, planId: 'plan-1' },
    ]);

    await handlePaymentFailure('pay-1', 'Insufficient funds');

    expect(mockTxUpdateSet).toHaveBeenCalledWith(
      expect.objectContaining({
        status: 'failed',
        failureReason: 'Insufficient funds',
      }),
    );

    expect(mockTxInsertValues).toHaveBeenCalledWith(
      expect.objectContaining({
        entityType: 'payment',
        entityId: 'pay-1',
        action: 'status_changed',
        actorType: 'system',
      }),
    );
  });

  it('marks payment as written_off when max retries exceeded', async () => {
    mockTxSelectLimit.mockResolvedValueOnce([
      { id: 'pay-1', status: 'processing', retryCount: 3, planId: 'plan-1' },
    ]);

    await handlePaymentFailure('pay-1', 'Card declined');

    expect(mockTxUpdateSet).toHaveBeenCalledWith(
      expect.objectContaining({
        status: 'written_off',
        failureReason: 'Card declined',
      }),
    );
  });

  it('skips update when payment is already in terminal failure state', async () => {
    mockTxSelectLimit.mockResolvedValueOnce([
      { id: 'pay-1', status: 'written_off', retryCount: 3, planId: 'plan-1' },
    ]);

    await handlePaymentFailure('pay-1', 'Another failure');

    expect(mockTxUpdateSet).not.toHaveBeenCalled();
  });

  it('throws when payment is not found', async () => {
    mockTxSelectLimit.mockResolvedValueOnce([]);

    await expect(handlePaymentFailure('pay-missing', 'Error')).rejects.toThrow(
      'Payment not found: pay-missing',
    );
  });
});

// ── Tests: handlePaymentSuccess — plan activation for deposits ───────

describe('handlePaymentSuccess — deposit plan activation', () => {
  afterEach(clearAllMocks);

  it('activates plan when deposit payment succeeds', async () => {
    // Fetch payment (deposit type)
    mockTxSelectLimit
      .mockResolvedValueOnce([
        {
          id: 'pay-dep-1',
          planId: 'plan-1',
          amountCents: 26_500,
          status: 'processing',
          type: 'deposit',
        },
      ])
      // Fetch plan (pending status)
      .mockResolvedValueOnce([
        { id: 'plan-1', clinicId: 'clinic-1', status: 'pending', totalBillCents: 106_000 },
      ])
      // Fetch clinic
      .mockResolvedValueOnce([{ stripeAccountId: 'acct_clinic_123' }]);

    await handlePaymentSuccess('pay-dep-1', 'pi_deposit_ok');

    // Verify plan status update to active
    const updateCalls = mockTxUpdateSet.mock.calls;
    const planUpdate = updateCalls.find((call: unknown[]) => {
      const arg = call[0] as Record<string, unknown>;
      return arg.status === 'active' && 'depositPaidAt' in arg;
    });
    expect(planUpdate).toBeDefined();

    // Verify plan activation audit log
    const insertCalls = mockTxInsertValues.mock.calls;
    const planAudit = insertCalls.find((call: unknown[]) => {
      const arg = call[0] as Record<string, unknown>;
      return arg.entityType === 'plan' && arg.entityId === 'plan-1';
    });
    expect(planAudit).toBeDefined();
  });

  it('skips plan activation when plan is already active', async () => {
    mockTxSelectLimit
      .mockResolvedValueOnce([
        {
          id: 'pay-dep-2',
          planId: 'plan-2',
          amountCents: 26_500,
          status: 'processing',
          type: 'deposit',
        },
      ])
      // Plan already active
      .mockResolvedValueOnce([
        { id: 'plan-2', clinicId: 'clinic-1', status: 'active', totalBillCents: 106_000 },
      ])
      .mockResolvedValueOnce([{ stripeAccountId: 'acct_clinic_123' }]);

    await handlePaymentSuccess('pay-dep-2', 'pi_deposit_ok');

    // Should NOT update plan status (only payment status update)
    const updateCalls = mockTxUpdateSet.mock.calls;
    const planUpdate = updateCalls.find((call: unknown[]) => {
      const arg = call[0] as Record<string, unknown>;
      return arg.status === 'active' && 'depositPaidAt' in arg;
    });
    expect(planUpdate).toBeUndefined();
  });
});

// ── Tests: handlePaymentSuccess — plan completion for installments ───

describe('handlePaymentSuccess — installment plan completion', () => {
  afterEach(clearAllMocks);

  it('completes plan when all installments succeed', async () => {
    // Fetch payment (installment type)
    mockTxSelectLimit
      .mockResolvedValueOnce([
        {
          id: 'pay-inst-7',
          planId: 'plan-1',
          amountCents: 13_250,
          status: 'processing',
          type: 'installment',
        },
      ])
      // Fetch plan
      .mockResolvedValueOnce([
        { id: 'plan-1', clinicId: 'clinic-1', status: 'active', totalBillCents: 106_000 },
      ])
      // All plan payments succeeded (completePlanIfAllPaid select)
      .mockResolvedValueOnce([
        { status: 'succeeded' },
        { status: 'succeeded' },
        { status: 'succeeded' },
        { status: 'succeeded' },
        { status: 'succeeded' },
        { status: 'succeeded' },
        { status: 'succeeded' },
      ])
      // Fetch clinic
      .mockResolvedValueOnce([{ stripeAccountId: 'acct_clinic_123' }]);

    await handlePaymentSuccess('pay-inst-7', 'pi_last_ok');

    // Verify plan completed
    const updateCalls = mockTxUpdateSet.mock.calls;
    const planComplete = updateCalls.find((call: unknown[]) => {
      const arg = call[0] as Record<string, unknown>;
      return arg.status === 'completed' && 'completedAt' in arg;
    });
    expect(planComplete).toBeDefined();
  });

  it('does not complete plan when some installments are still pending', async () => {
    mockTxSelectLimit
      .mockResolvedValueOnce([
        {
          id: 'pay-inst-3',
          planId: 'plan-1',
          amountCents: 13_250,
          status: 'processing',
          type: 'installment',
        },
      ])
      .mockResolvedValueOnce([
        { id: 'plan-1', clinicId: 'clinic-1', status: 'active', totalBillCents: 106_000 },
      ])
      // Not all payments succeeded
      .mockResolvedValueOnce([
        { status: 'succeeded' },
        { status: 'succeeded' },
        { status: 'succeeded' },
        { status: 'pending' },
        { status: 'pending' },
        { status: 'pending' },
        { status: 'pending' },
      ])
      .mockResolvedValueOnce([{ stripeAccountId: 'acct_clinic_123' }]);

    await handlePaymentSuccess('pay-inst-3', 'pi_mid_ok');

    // Should NOT update plan to completed
    const updateCalls = mockTxUpdateSet.mock.calls;
    const planComplete = updateCalls.find((call: unknown[]) => {
      const arg = call[0] as Record<string, unknown>;
      return arg.status === 'completed';
    });
    expect(planComplete).toBeUndefined();
  });
});

// ── Tests: findPaymentByStripeId ─────────────────────────────────────

describe('findPaymentByStripeId', () => {
  beforeEach(() => {
    setupSelectChain();
  });

  afterEach(clearAllMocks);

  it('returns payment when found', async () => {
    mockSelectLimit.mockResolvedValueOnce([{ id: 'pay-1', status: 'processing' }]);

    const result = await findPaymentByStripeId('pi_test_123');

    expect(result).toEqual({ id: 'pay-1', status: 'processing' });
  });

  it('returns null when payment is not found', async () => {
    mockSelectLimit.mockResolvedValueOnce([]);

    const result = await findPaymentByStripeId('pi_unknown');

    expect(result).toBeNull();
  });
});
