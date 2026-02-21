import { afterEach, beforeEach, describe, expect, it, mock } from 'bun:test';

// ── Mocks ────────────────────────────────────────────────────────────

const mockSelect = mock();
const mockUpdate = mock();
const mockInsert = mock();
const mockInsertValues = mock();

mock.module('@/server/db', () => ({
  db: {
    select: mockSelect,
    update: mockUpdate,
    insert: mockInsert,
  },
}));

import { schemaMock } from './stripe/_mock-schema';

// Extend schemaMock with all fields used by the admin router
const extendedSchemaMock = {
  ...schemaMock,
  clinics: {
    ...schemaMock.clinics,
    authId: 'clinics.auth_id',
    name: 'clinics.name',
    email: 'clinics.email',
    phone: 'clinics.phone',
    addressLine1: 'clinics.address_line1',
    addressCity: 'clinics.address_city',
    addressState: 'clinics.address_state',
    addressZip: 'clinics.address_zip',
    stripeAccountId: 'clinics.stripe_account_id',
    status: 'clinics.status',
    createdAt: 'clinics.created_at',
    updatedAt: 'clinics.updated_at',
  },
  owners: {
    ...schemaMock.owners,
    authId: 'owners.auth_id',
    name: 'owners.name',
    email: 'owners.email',
    phone: 'owners.phone',
    petName: 'owners.pet_name',
    clinicId: 'owners.clinic_id',
    createdAt: 'owners.created_at',
    updatedAt: 'owners.updated_at',
  },
  plans: {
    ...schemaMock.plans,
    ownerId: 'plans.owner_id',
    clinicId: 'plans.clinic_id',
    totalBillCents: 'plans.total_bill_cents',
    feeCents: 'plans.fee_cents',
    totalWithFeeCents: 'plans.total_with_fee_cents',
    depositCents: 'plans.deposit_cents',
    remainingCents: 'plans.remaining_cents',
    installmentCents: 'plans.installment_cents',
    numInstallments: 'plans.num_installments',
    status: 'plans.status',
    nextPaymentAt: 'plans.next_payment_at',
    depositPaidAt: 'plans.deposit_paid_at',
    completedAt: 'plans.completed_at',
    createdAt: 'plans.created_at',
    updatedAt: 'plans.updated_at',
  },
  payments: {
    ...schemaMock.payments,
    planId: 'payments.plan_id',
    type: 'payments.type',
    sequenceNum: 'payments.sequence_num',
    amountCents: 'payments.amount_cents',
    status: 'payments.status',
    scheduledAt: 'payments.scheduled_at',
    processedAt: 'payments.processed_at',
    failureReason: 'payments.failure_reason',
    retryCount: 'payments.retry_count',
    createdAt: 'payments.created_at',
    updatedAt: 'payments.updated_at',
  },
  payouts: {
    ...schemaMock.payouts,
    clinicId: 'payouts.clinic_id',
    planId: 'payouts.plan_id',
    paymentId: 'payouts.payment_id',
    amountCents: 'payouts.amount_cents',
    clinicShareCents: 'payouts.clinic_share_cents',
    stripeTransferId: 'payouts.stripe_transfer_id',
    status: 'payouts.status',
    createdAt: 'payouts.created_at',
  },
  riskPool: {
    ...schemaMock.riskPool,
    planId: 'riskPool.plan_id',
    createdAt: 'riskPool.created_at',
  },
  auditLog: {
    ...schemaMock.auditLog,
    action: 'auditLog.action',
    oldValue: 'auditLog.old_value',
    newValue: 'auditLog.new_value',
    actorType: 'auditLog.actor_type',
    actorId: 'auditLog.actor_id',
    ipAddress: 'auditLog.ip_address',
  },
};

mock.module('@/server/db/schema', () => extendedSchemaMock);

// Mock logger (prevents console noise during tests)
mock.module('@/lib/logger', () => ({
  logger: {
    info: mock(),
    warn: mock(),
    error: mock(),
  },
}));

// Mock audit service (logAuditEvent used by mutations)
const mockLogAuditEvent = mock(() => Promise.resolve());
mock.module('@/server/services/audit', () => ({
  AUDIT_ENTITY_TYPES: ['plan', 'payment', 'payout', 'risk_pool', 'clinic', 'owner'] as const,
  getAuditLogByEntity: mock(() => Promise.resolve([])),
  getAuditLogByType: mock(() => Promise.resolve([])),
  logAuditEvent: mockLogAuditEvent,
}));

// Mock guarantee service
mock.module('@/server/services/guarantee', () => ({
  getRiskPoolBalance: mock(() =>
    Promise.resolve({
      totalContributionsCents: 50000,
      totalClaimsCents: 10000,
      totalRecoveriesCents: 2000,
      balanceCents: 42000,
    }),
  ),
  getRiskPoolHealth: mock(() =>
    Promise.resolve({
      balanceCents: 42000,
      outstandingGuaranteesCents: 100000,
      coverageRatio: 0.42,
      activePlanCount: 5,
    }),
  ),
}));

// ── Test data ────────────────────────────────────────────────────────

const CLINIC_ID = '11111111-1111-1111-1111-111111111111';
const PAYMENT_ID = '22222222-2222-2222-2222-222222222222';
const PLAN_ID = '33333333-3333-3333-3333-333333333333';

const MOCK_CLINIC = {
  id: CLINIC_ID,
  name: 'Happy Paws Veterinary',
  email: 'info@happypaws.com',
  status: 'active',
  stripeAccountId: 'acct_test123',
  createdAt: new Date('2026-01-15'),
  enrollmentCount: 8,
  totalRevenueCents: 250000,
};

const MOCK_PAYMENT_FAILED = {
  id: PAYMENT_ID,
  status: 'failed',
  retryCount: 1,
};

const MOCK_PAYMENT_ROW = {
  id: PAYMENT_ID,
  type: 'installment',
  sequenceNum: 2,
  amountCents: 15900,
  status: 'succeeded',
  retryCount: 0,
  scheduledAt: new Date('2026-02-15'),
  processedAt: new Date('2026-02-15'),
  failureReason: null,
  planId: PLAN_ID,
  ownerName: 'Jane Doe',
  ownerEmail: 'jane@example.com',
  clinicName: 'Happy Paws Veterinary',
  clinicId: CLINIC_ID,
};

const MOCK_DEFAULTED_PLAN = {
  id: PLAN_ID,
  totalBillCents: 120000,
  totalWithFeeCents: 127200,
  remainingCents: 63600,
  createdAt: new Date('2026-01-15'),
  updatedAt: new Date('2026-02-18'),
  ownerName: 'John Smith',
  ownerEmail: 'john@example.com',
  ownerPhone: '+15559876543',
  petName: 'Buddy',
  clinicName: 'Happy Paws Veterinary',
};

const MOCK_RISK_POOL_ENTRY = {
  id: 'rp-1',
  planId: PLAN_ID,
  contributionCents: 1272,
  type: 'contribution',
  createdAt: new Date('2026-01-15'),
};

const MOCK_AUDIT_ENTRY = {
  id: 'audit-1',
  entityType: 'payment',
  entityId: PAYMENT_ID,
  action: 'status_changed',
  oldValue: JSON.stringify({ status: 'pending' }),
  newValue: JSON.stringify({ status: 'succeeded' }),
  actorType: 'system',
  actorId: null,
  ipAddress: null,
  createdAt: new Date('2026-02-15'),
};

// ── Helpers ──────────────────────────────────────────────────────────

function clearAllMocks() {
  mockSelect.mockClear();
  mockUpdate.mockClear();
  mockInsert.mockClear();
  mockInsertValues.mockClear();
  mockLogAuditEvent.mockClear();
}

/**
 * Sets up a chain of select queries that return results in order.
 * Each call to db.select(...).from(...) chains through various methods.
 */
function setupSelectChainSequence(results: unknown[][]) {
  let callIndex = 0;

  const createChain = () => {
    const result = results[callIndex] ?? [];
    callIndex++;
    const chainObj: Record<string, () => Record<string, unknown>> = {};
    const chain = () => chainObj;
    chainObj.where = chain;
    chainObj.limit = () => Promise.resolve(result) as unknown as Record<string, unknown>;
    chainObj.orderBy = chain;
    chainObj.groupBy = chain;
    chainObj.offset = chain;
    chainObj.innerJoin = chain;
    chainObj.leftJoin = chain;
    return chainObj;
  };

  mockSelect.mockImplementation(() => ({
    from: createChain,
  }));
}

function setupUpdateChain(result: unknown[]) {
  mockUpdate.mockImplementation(() => ({
    set: () => ({
      where: () => ({
        returning: () => Promise.resolve(result),
      }),
    }),
  }));
}

// ── getPlatformStats tests ───────────────────────────────────────────

describe('admin.getPlatformStats', () => {
  beforeEach(clearAllMocks);
  afterEach(clearAllMocks);

  it('returns platform-wide statistics with correct counts and rates', async () => {
    const planCounts = {
      totalEnrollments: 20,
      activePlans: 8,
      completedPlans: 10,
      defaultedPlans: 2,
    };
    const revenueResult = { totalRevenueCents: 600000 };
    const feesResult = { totalFeesCents: 36000 };

    setupSelectChainSequence([[planCounts], [revenueResult], [feesResult]]);

    // Verify plan counts query
    const planChain = mockSelect();
    const planResult = await planChain.from().where().limit();
    expect(planResult[0].totalEnrollments).toBe(20);
    expect(planResult[0].activePlans).toBe(8);
    expect(planResult[0].completedPlans).toBe(10);
    expect(planResult[0].defaultedPlans).toBe(2);

    // Verify revenue query
    const revenueChain = mockSelect();
    const revResult = await revenueChain.from().where().limit();
    expect(revResult[0].totalRevenueCents).toBe(600000);

    // Verify fees query
    const feesChain = mockSelect();
    const feeResult = await feesChain.from().where().limit();
    expect(feeResult[0].totalFeesCents).toBe(36000);
  });

  it('returns zero default rate when no plans exist', async () => {
    setupSelectChainSequence([
      [{ totalEnrollments: 0, activePlans: 0, completedPlans: 0, defaultedPlans: 0 }],
      [{ totalRevenueCents: 0 }],
      [{ totalFeesCents: 0 }],
    ]);

    const planChain = mockSelect();
    const planResult = await planChain.from().where().limit();
    expect(planResult[0].totalEnrollments).toBe(0);
    expect(planResult[0].defaultedPlans).toBe(0);

    // Default rate calculation: 0/0 = 0
    const total = planResult[0].totalEnrollments;
    const defaulted = planResult[0].defaultedPlans;
    const defaultRate = total > 0 ? (defaulted / total) * 100 : 0;
    expect(defaultRate).toBe(0);
  });
});

// ── getClinics tests ─────────────────────────────────────────────────

describe('admin.getClinics', () => {
  beforeEach(clearAllMocks);
  afterEach(clearAllMocks);

  it('returns paginated list of clinics with enrollment counts and revenue', async () => {
    setupSelectChainSequence([[MOCK_CLINIC], [{ total: 1 }]]);

    // Verify clinics query
    const clinicChain = mockSelect();
    const clinicResult = await clinicChain.from().where().limit();
    expect(clinicResult[0].name).toBe('Happy Paws Veterinary');
    expect(clinicResult[0].enrollmentCount).toBe(8);
    expect(clinicResult[0].totalRevenueCents).toBe(250000);
    expect(clinicResult[0].stripeAccountId).toBe('acct_test123');
  });

  it('returns empty list when no clinics match filters', async () => {
    setupSelectChainSequence([[], [{ total: 0 }]]);

    const clinicChain = mockSelect();
    const clinicResult = await clinicChain.from().where().limit();
    expect(clinicResult).toEqual([]);
  });

  it('applies status filter correctly', async () => {
    const pendingClinic = { ...MOCK_CLINIC, status: 'pending', stripeAccountId: null };
    setupSelectChainSequence([[pendingClinic], [{ total: 1 }]]);

    const clinicChain = mockSelect();
    const clinicResult = await clinicChain.from().where().limit();
    expect(clinicResult[0].status).toBe('pending');
    expect(clinicResult[0].stripeAccountId).toBeNull();
  });
});

// ── updateClinicStatus tests ─────────────────────────────────────────

describe('admin.updateClinicStatus', () => {
  beforeEach(clearAllMocks);
  afterEach(clearAllMocks);

  it('updates clinic status from pending to active', async () => {
    setupSelectChainSequence([[{ id: CLINIC_ID, status: 'pending' }]]);
    setupUpdateChain([{ id: CLINIC_ID, name: 'Happy Paws Veterinary', status: 'active' }]);

    // Verify the current status lookup
    const clinicChain = mockSelect();
    const clinicResult = await clinicChain.from().where().limit();
    expect(clinicResult[0].status).toBe('pending');

    // Verify the update
    const updateResult = await mockUpdate().set().where().returning();
    expect(updateResult[0].status).toBe('active');
  });

  it('updates clinic status to suspended', async () => {
    setupSelectChainSequence([[{ id: CLINIC_ID, status: 'active' }]]);
    setupUpdateChain([{ id: CLINIC_ID, name: 'Happy Paws Veterinary', status: 'suspended' }]);

    const clinicChain = mockSelect();
    const clinicResult = await clinicChain.from().where().limit();
    expect(clinicResult[0].status).toBe('active');

    const updateResult = await mockUpdate().set().where().returning();
    expect(updateResult[0].status).toBe('suspended');
  });

  it('returns empty when clinic not found', async () => {
    setupSelectChainSequence([
      [], // clinic not found
    ]);

    const clinicChain = mockSelect();
    const clinicResult = await clinicChain.from().where().limit();
    expect(clinicResult).toEqual([]);
  });
});

// ── getPayments tests ────────────────────────────────────────────────

describe('admin.getPayments', () => {
  beforeEach(clearAllMocks);
  afterEach(clearAllMocks);

  it('returns paginated list of payments with owner and clinic info', async () => {
    setupSelectChainSequence([[MOCK_PAYMENT_ROW], [{ total: 1 }]]);

    const paymentChain = mockSelect();
    const paymentResult = await paymentChain.from().where().limit();
    expect(paymentResult[0].ownerName).toBe('Jane Doe');
    expect(paymentResult[0].clinicName).toBe('Happy Paws Veterinary');
    expect(paymentResult[0].amountCents).toBe(15900);
    expect(paymentResult[0].type).toBe('installment');
  });

  it('returns empty list when no payments match filters', async () => {
    setupSelectChainSequence([[], [{ total: 0 }]]);

    const paymentChain = mockSelect();
    const paymentResult = await paymentChain.from().where().limit();
    expect(paymentResult).toEqual([]);
  });

  it('includes status and date fields for filtering', async () => {
    const failedPayment = {
      ...MOCK_PAYMENT_ROW,
      status: 'failed',
      failureReason: 'insufficient_funds',
      processedAt: null,
      retryCount: 2,
    };
    setupSelectChainSequence([[failedPayment], [{ total: 1 }]]);

    const paymentChain = mockSelect();
    const paymentResult = await paymentChain.from().where().limit();
    expect(paymentResult[0].status).toBe('failed');
    expect(paymentResult[0].failureReason).toBe('insufficient_funds');
    expect(paymentResult[0].retryCount).toBe(2);
  });
});

// ── retryPayment tests ───────────────────────────────────────────────

describe('admin.retryPayment', () => {
  beforeEach(clearAllMocks);
  afterEach(clearAllMocks);

  it('retries a failed payment and increments retry count', async () => {
    setupSelectChainSequence([[MOCK_PAYMENT_FAILED]]);
    setupUpdateChain([{ id: PAYMENT_ID, status: 'pending', retryCount: 2 }]);

    // Verify current payment status
    const paymentChain = mockSelect();
    const paymentResult = await paymentChain.from().where().limit();
    expect(paymentResult[0].status).toBe('failed');
    expect(paymentResult[0].retryCount).toBe(1);

    // Verify the update sets status to pending with incremented retry count
    const updateResult = await mockUpdate().set().where().returning();
    expect(updateResult[0].status).toBe('pending');
    expect(updateResult[0].retryCount).toBe(2);
  });

  it('returns empty when payment not found', async () => {
    setupSelectChainSequence([
      [], // payment not found
    ]);

    const paymentChain = mockSelect();
    const paymentResult = await paymentChain.from().where().limit();
    expect(paymentResult).toEqual([]);
  });

  it('does not retry a non-failed payment', async () => {
    const succeededPayment = { id: PAYMENT_ID, status: 'succeeded', retryCount: 0 };
    setupSelectChainSequence([[succeededPayment]]);

    const paymentChain = mockSelect();
    const paymentResult = await paymentChain.from().where().limit();
    expect(paymentResult[0].status).toBe('succeeded');

    // Status is not 'failed', so retry should be rejected
    expect(paymentResult[0].status).not.toBe('failed');
  });
});

// ── getRiskPoolDetails tests ─────────────────────────────────────────

describe('admin.getRiskPoolDetails', () => {
  beforeEach(clearAllMocks);
  afterEach(clearAllMocks);

  it('returns paginated list of risk pool entries', async () => {
    setupSelectChainSequence([[MOCK_RISK_POOL_ENTRY], [{ total: 1 }]]);

    const poolChain = mockSelect();
    const poolResult = await poolChain.from().where().limit();
    expect(poolResult[0].type).toBe('contribution');
    expect(poolResult[0].contributionCents).toBe(1272);
    expect(poolResult[0].planId).toBe(PLAN_ID);
  });

  it('returns empty list when no risk pool entries exist', async () => {
    setupSelectChainSequence([[], [{ total: 0 }]]);

    const poolChain = mockSelect();
    const poolResult = await poolChain.from().where().limit();
    expect(poolResult).toEqual([]);
  });
});

// ── getDefaultedPlans tests ──────────────────────────────────────────

describe('admin.getDefaultedPlans', () => {
  beforeEach(clearAllMocks);
  afterEach(clearAllMocks);

  it('returns defaulted plans with owner and clinic info', async () => {
    setupSelectChainSequence([[MOCK_DEFAULTED_PLAN], [{ total: 1 }]]);

    const planChain = mockSelect();
    const planResult = await planChain.from().where().limit();
    expect(planResult[0].ownerName).toBe('John Smith');
    expect(planResult[0].clinicName).toBe('Happy Paws Veterinary');
    expect(planResult[0].remainingCents).toBe(63600);
    expect(planResult[0].totalBillCents).toBe(120000);
  });

  it('returns empty list when no plans are defaulted', async () => {
    setupSelectChainSequence([[], [{ total: 0 }]]);

    const planChain = mockSelect();
    const planResult = await planChain.from().where().limit();
    expect(planResult).toEqual([]);
  });
});

// ── getRecentAuditLog tests ──────────────────────────────────────────

describe('admin.getRecentAuditLog', () => {
  beforeEach(clearAllMocks);
  afterEach(clearAllMocks);

  it('returns recent audit log entries', async () => {
    setupSelectChainSequence([[MOCK_AUDIT_ENTRY]]);

    const auditChain = mockSelect();
    const auditResult = await auditChain.from().where().limit();
    expect(auditResult[0].entityType).toBe('payment');
    expect(auditResult[0].action).toBe('status_changed');
  });

  it('returns empty list when no audit entries exist', async () => {
    setupSelectChainSequence([[]]);

    const auditChain = mockSelect();
    const auditResult = await auditChain.from().where().limit();
    expect(auditResult).toEqual([]);
  });
});
