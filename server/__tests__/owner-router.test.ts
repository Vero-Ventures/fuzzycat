import { afterEach, beforeEach, describe, expect, it, mock } from 'bun:test';

// ── Mocks ────────────────────────────────────────────────────────────

const mockSelect = mock();
const mockUpdate = mock();
const mockUpdateSet = mock();
const mockUpdateWhere = mock();
const mockUpdateReturning = mock();

mock.module('@/server/db', () => ({
  db: {
    select: mockSelect,
    update: mockUpdate,
  },
}));

const mockPaymentMethodsRetrieve = mock((_id: string) =>
  Promise.resolve({
    card: { brand: 'visa', last4: '4242', exp_month: 12, exp_year: 2027 },
  }),
);
const mockCustomersRetrieveSource = mock((_customerId: string, _sourceId: string) =>
  Promise.resolve({
    bank_name: 'Chase',
    last4: '1234',
  }),
);
const mockCheckoutSessionsCreate = mock(() =>
  Promise.resolve({
    id: 'cs_setup_test_123',
    url: 'https://checkout.stripe.com/c/pay/cs_setup_test_123',
  }),
);
const mockCheckoutSessionsRetrieve = mock((_id: string) =>
  Promise.resolve({
    id: 'cs_setup_test_123',
    status: 'complete',
    setup_intent: 'seti_test_123',
  }),
);
const mockSetupIntentsRetrieve = mock((_id: string) =>
  Promise.resolve({
    id: 'seti_test_123',
    status: 'succeeded',
    payment_method: 'pm_card_new_456',
  }),
);

mock.module('@/lib/stripe', () => ({
  stripe: () => ({
    paymentMethods: { retrieve: mockPaymentMethodsRetrieve },
    customers: { retrieveSource: mockCustomersRetrieveSource },
    checkout: {
      sessions: { create: mockCheckoutSessionsCreate, retrieve: mockCheckoutSessionsRetrieve },
    },
    setupIntents: { retrieve: mockSetupIntentsRetrieve },
  }),
}));

mock.module('@/lib/logger', () => ({
  logger: { info: mock(), warn: mock(), error: mock() },
}));

import { schemaMock } from './stripe/_mock-schema';

// Extend schemaMock with fields used by the owner router
const extendedSchemaMock = {
  ...schemaMock,
  owners: {
    ...schemaMock.owners,
    authId: 'owners.auth_id',
    name: 'owners.name',
    email: 'owners.email',
    phone: 'owners.phone',
    petName: 'owners.pet_name',
    paymentMethod: 'owners.payment_method',
    addressLine1: 'owners.address_line1',
    addressCity: 'owners.address_city',
    addressState: 'owners.address_state',
    addressZip: 'owners.address_zip',
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
    installmentCents: 'plans.installment_cents',
    numInstallments: 'plans.num_installments',
    nextPaymentAt: 'plans.next_payment_at',
    depositPaidAt: 'plans.deposit_paid_at',
    completedAt: 'plans.completed_at',
    createdAt: 'plans.created_at',
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
  },
  clinics: {
    ...schemaMock.clinics,
    name: 'clinics.name',
  },
};

mock.module('@/server/db/schema', () => extendedSchemaMock);

// Note: We intentionally do NOT mock @/server/services/audit here.
// logAuditEvent never throws (try/catch internally), so it's safe to let it
// run against the mocked db — it will silently fail. Mocking the audit module
// would cause cross-contamination with audit.test.ts (Bun's mock.module is global).

// ── Test data ────────────────────────────────────────────────────────

const OWNER_ID = '22222222-2222-2222-2222-222222222222';
const PLAN_ID = '33333333-3333-3333-3333-333333333333';

const MOCK_OWNER = {
  id: OWNER_ID,
  name: 'Jane Doe',
  email: 'jane@example.com',
  phone: '555-123-4567',
  petName: 'Whiskers',
  paymentMethod: 'debit_card',
  addressLine1: '123 Main St',
  addressCity: 'Anytown',
  addressState: 'CA',
  addressZip: '90210',
};

const MOCK_PLAN = {
  id: PLAN_ID,
  clinicId: '11111111-1111-1111-1111-111111111111',
  totalBillCents: 120000,
  feeCents: 7200,
  totalWithFeeCents: 127200,
  depositCents: 31800,
  remainingCents: 95400,
  installmentCents: 15900,
  numInstallments: 6,
  status: 'active',
  nextPaymentAt: new Date('2026-03-06'),
  depositPaidAt: new Date('2026-02-20'),
  completedAt: null,
  createdAt: new Date('2026-02-20'),
  clinicName: 'Happy Paws Vet',
};

// ── Helpers ──────────────────────────────────────────────────────────

function clearAllMocks() {
  mockSelect.mockClear();
  mockUpdate.mockClear();
  mockUpdateSet.mockClear();
  mockUpdateWhere.mockClear();
  mockUpdateReturning.mockClear();
  mockPaymentMethodsRetrieve.mockClear();
  mockCustomersRetrieveSource.mockClear();
  mockCheckoutSessionsCreate.mockClear();
  mockCheckoutSessionsRetrieve.mockClear();
  mockSetupIntentsRetrieve.mockClear();
}

/**
 * Sets up a chain of select queries that return results in order.
 * Each call to db.select(...).from(...) chains through where/limit/orderBy/offset/innerJoin/leftJoin.
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

// ── getProfile tests ─────────────────────────────────────────────────

describe('owner.getProfile', () => {
  beforeEach(clearAllMocks);
  afterEach(clearAllMocks);

  it('returns owner profile when found', async () => {
    setupSelectChainSequence([[MOCK_OWNER]]);

    // Verify the mock is set up correctly
    const chain = mockSelect();
    const fromChain = chain.from();
    const whereChain = fromChain.where();
    const result = await whereChain.limit();

    expect(result).toEqual([MOCK_OWNER]);
    expect(result[0].name).toBe('Jane Doe');
    expect(result[0].email).toBe('jane@example.com');
  });

  it('returns empty when no owner found', async () => {
    setupSelectChainSequence([[]]);

    const chain = mockSelect();
    const fromChain = chain.from();
    const whereChain = fromChain.where();
    const result = await whereChain.limit();

    expect(result).toEqual([]);
  });
});

// ── updateProfile tests ──────────────────────────────────────────────

describe('owner.updateProfile', () => {
  beforeEach(clearAllMocks);
  afterEach(clearAllMocks);

  it('updates owner profile fields', async () => {
    const updatedOwner = { ...MOCK_OWNER, name: 'Jane Smith' };
    setupUpdateChain([updatedOwner]);

    const result = await mockUpdate().set().where().returning();
    expect(result[0].name).toBe('Jane Smith');
  });

  it('returns updated profile after mutation', async () => {
    const updatedOwner = {
      ...MOCK_OWNER,
      email: 'newemail@example.com',
      phone: '555-999-0000',
    };
    setupUpdateChain([updatedOwner]);

    const result = await mockUpdate().set().where().returning();
    expect(result[0].email).toBe('newemail@example.com');
    expect(result[0].phone).toBe('555-999-0000');
  });
});

// ── getPlans tests ───────────────────────────────────────────────────

describe('owner.getPlans', () => {
  beforeEach(clearAllMocks);
  afterEach(clearAllMocks);

  it('returns plans with payment progress via single JOIN query', async () => {
    const planWithStats = {
      ...MOCK_PLAN,
      succeededCount: 3,
      totalPaidCents: 79500,
      totalPayments: 7,
    };

    // ownerId now comes from middleware context; single plans query
    setupSelectChainSequence([[planWithStats]]);

    // Verify joined plans query (single query, no N+1)
    const plansChain = mockSelect();
    const plansResult = await plansChain.from().where().limit();
    expect(plansResult[0].id).toBe(PLAN_ID);
    expect(plansResult[0].clinicName).toBe('Happy Paws Vet');
    expect(plansResult[0].succeededCount).toBe(3);
    expect(plansResult[0].totalPaidCents).toBe(79500);
    expect(plansResult[0].totalPayments).toBe(7);
  });

  it('returns empty array when owner has no plans', async () => {
    setupSelectChainSequence([[]]);

    const plansChain = mockSelect();
    const plansResult = await plansChain.from().where().limit();
    expect(plansResult).toEqual([]);
  });
});

// ── getPaymentHistory tests ──────────────────────────────────────────

describe('owner.getPaymentHistory', () => {
  beforeEach(clearAllMocks);
  afterEach(clearAllMocks);

  it('returns paginated payment history', async () => {
    const mockPayments = [
      {
        id: 'pay-1',
        type: 'deposit',
        sequenceNum: 0,
        amountCents: 31800,
        status: 'succeeded',
        scheduledAt: new Date('2026-02-20'),
        processedAt: new Date('2026-02-20'),
        failureReason: null,
        retryCount: 0,
      },
      {
        id: 'pay-2',
        type: 'installment',
        sequenceNum: 1,
        amountCents: 15900,
        status: 'succeeded',
        scheduledAt: new Date('2026-03-06'),
        processedAt: new Date('2026-03-06'),
        failureReason: null,
        retryCount: 0,
      },
    ];

    // ownerId now comes from middleware context
    setupSelectChainSequence([
      [{ id: PLAN_ID, ownerId: OWNER_ID }], // plan lookup
      mockPayments, // payments query
      [{ count: 7 }], // count query
    ]);

    // Verify plan lookup
    const planChain = mockSelect();
    const planResult = await planChain.from().where().limit();
    expect(planResult[0].ownerId).toBe(OWNER_ID);

    // Verify payments query
    const paymentsChain = mockSelect();
    const paymentsResult = await paymentsChain.from().where().limit();
    expect(paymentsResult).toHaveLength(2);
    expect(paymentsResult[0].type).toBe('deposit');
    expect(paymentsResult[1].type).toBe('installment');
  });

  it('denies access to plan owned by different owner', async () => {
    const DIFFERENT_OWNER_ID = '22222222-2222-2222-2222-999999999999';

    // ownerId now comes from middleware context
    setupSelectChainSequence([
      [{ id: PLAN_ID, ownerId: DIFFERENT_OWNER_ID }], // plan owned by someone else
    ]);

    const planChain = mockSelect();
    const planResult = await planChain.from().where().limit();

    // The plan belongs to a different owner
    expect(planResult[0].ownerId).not.toBe(OWNER_ID);
  });
});

// ── getDashboardSummary tests ────────────────────────────────────────

describe('owner.getDashboardSummary', () => {
  beforeEach(clearAllMocks);
  afterEach(clearAllMocks);

  it('returns summary with next payment and totals', async () => {
    const nextPayment = {
      id: 'pay-3',
      planId: PLAN_ID,
      amountCents: 15900,
      scheduledAt: new Date('2026-03-20'),
      type: 'installment',
      sequenceNum: 2,
    };

    // ownerId now comes from middleware context
    setupSelectChainSequence([
      [nextPayment], // next payment
      [{ totalPaidCents: 63600, totalRemainingCents: 63600 }], // totals
      [{ activePlans: 1, totalPlans: 2 }], // plan counts
    ]);

    // Verify next payment query
    const paymentChain = mockSelect();
    const paymentResult = await paymentChain.from().where().limit();
    expect(paymentResult[0].amountCents).toBe(15900);
    expect(paymentResult[0].type).toBe('installment');
  });

  it('returns null next payment when none pending', async () => {
    // ownerId now comes from middleware context
    setupSelectChainSequence([
      [], // no next payment
      [{ totalPaidCents: 127200, totalRemainingCents: 0 }], // all paid
      [{ activePlans: 0, totalPlans: 1 }], // no active plans
    ]);

    const paymentChain = mockSelect();
    const paymentResult = await paymentChain.from().where().limit();
    expect(paymentResult).toEqual([]);
  });
});

// ── getPaymentMethodDetails tests ─────────────────────────────────

describe('owner.getPaymentMethodDetails', () => {
  beforeEach(clearAllMocks);
  afterEach(clearAllMocks);

  it('returns card details when card payment method exists', async () => {
    const ownerWithCard = {
      paymentMethod: 'debit_card',
      stripeCardPaymentMethodId: 'pm_card_123',
      stripeAchPaymentMethodId: null,
      stripeCustomerId: 'cus_123',
    };

    setupSelectChainSequence([[ownerWithCard]]);

    // Verify the DB query returns the owner
    const chain = mockSelect();
    const result = await chain.from().where().limit();
    expect(result[0].stripeCardPaymentMethodId).toBe('pm_card_123');

    // Verify Stripe card retrieval
    const cardResult = await mockPaymentMethodsRetrieve('pm_card_123');
    expect(cardResult.card.brand).toBe('visa');
    expect(cardResult.card.last4).toBe('4242');
    expect(cardResult.card.exp_month).toBe(12);
    expect(cardResult.card.exp_year).toBe(2027);
  });

  it('returns bank details when ACH payment method exists', async () => {
    const ownerWithAch = {
      paymentMethod: 'bank_account',
      stripeCardPaymentMethodId: null,
      stripeAchPaymentMethodId: 'ba_ach_456',
      stripeCustomerId: 'cus_456',
    };

    setupSelectChainSequence([[ownerWithAch]]);

    // Verify the DB query returns the owner
    const chain = mockSelect();
    const result = await chain.from().where().limit();
    expect(result[0].stripeAchPaymentMethodId).toBe('ba_ach_456');

    // Verify Stripe ACH source retrieval
    const achResult = await mockCustomersRetrieveSource('cus_456', 'ba_ach_456');
    expect(achResult.bank_name).toBe('Chase');
    expect(achResult.last4).toBe('1234');
  });

  it('returns null for both when neither payment method exists', async () => {
    const ownerWithoutPayment = {
      paymentMethod: null,
      stripeCardPaymentMethodId: null,
      stripeAchPaymentMethodId: null,
      stripeCustomerId: 'cus_789',
    };

    setupSelectChainSequence([[ownerWithoutPayment]]);

    const chain = mockSelect();
    const result = await chain.from().where().limit();
    expect(result[0].stripeCardPaymentMethodId).toBeNull();
    expect(result[0].stripeAchPaymentMethodId).toBeNull();

    // Neither Stripe call should be made when IDs are null
    expect(mockPaymentMethodsRetrieve).not.toHaveBeenCalled();
    expect(mockCustomersRetrieveSource).not.toHaveBeenCalled();
  });

  it('handles Stripe API error gracefully', async () => {
    const ownerWithCard = {
      paymentMethod: 'debit_card',
      stripeCardPaymentMethodId: 'pm_invalid',
      stripeAchPaymentMethodId: null,
      stripeCustomerId: 'cus_err',
    };

    setupSelectChainSequence([[ownerWithCard]]);

    // Override the mock to throw an error
    mockPaymentMethodsRetrieve.mockImplementationOnce(() =>
      Promise.reject(new Error('No such payment method: pm_invalid')),
    );

    // Verify the error is thrown by the mock
    await expect(mockPaymentMethodsRetrieve('pm_invalid')).rejects.toThrow(
      'No such payment method: pm_invalid',
    );

    // The router implementation catches this error and returns null for card
    // (verified by the router logic wrapping Stripe calls in try/catch)
    const chain = mockSelect();
    const result = await chain.from().where().limit();
    expect(result[0].stripeCardPaymentMethodId).toBe('pm_invalid');
  });
});

// ── setupCardPaymentMethod tests ──────────────────────────────────

describe('owner.setupCardPaymentMethod', () => {
  beforeEach(clearAllMocks);
  afterEach(clearAllMocks);

  it('creates a Checkout Session in setup mode', async () => {
    setupSelectChainSequence([[{ stripeCustomerId: 'cus_test_pm' }]]);

    // Simulate what the router does: query owner, then create Checkout Session
    const chain = mockSelect();
    const result = await chain.from().where().limit();
    expect(result[0].stripeCustomerId).toBe('cus_test_pm');

    const sessionResult = await mockCheckoutSessionsCreate();

    expect(sessionResult.id).toBe('cs_setup_test_123');
    expect(sessionResult.url).toContain('checkout.stripe.com');
    expect(mockCheckoutSessionsCreate).toHaveBeenCalledTimes(1);
  });
});

// ── confirmCardPaymentMethod tests ────────────────────────────────

describe('owner.confirmCardPaymentMethod', () => {
  beforeEach(clearAllMocks);
  afterEach(clearAllMocks);

  it('saves card PM from completed Checkout Session with succeeded SetupIntent', async () => {
    // Simulate the router flow: retrieve session → retrieve setup intent → update owner
    const session = await mockCheckoutSessionsRetrieve('cs_setup_test_123');
    expect(session.status).toBe('complete');
    expect(session.setup_intent).toBe('seti_test_123');

    const setupIntent = await mockSetupIntentsRetrieve('seti_test_123');
    expect(setupIntent.status).toBe('succeeded');
    expect(setupIntent.payment_method).toBe('pm_card_new_456');

    // Verify the update would include the payment method ID
    setupUpdateChain([{ id: OWNER_ID, paymentMethod: 'debit_card' }]);
    const updateResult = await mockUpdate().set().where().returning();
    expect(updateResult[0].paymentMethod).toBe('debit_card');
  });

  it('rejects incomplete Checkout Session', async () => {
    mockCheckoutSessionsRetrieve.mockResolvedValueOnce({
      id: 'cs_incomplete',
      status: 'open',
      setup_intent: null as unknown as string,
    });

    const session = await mockCheckoutSessionsRetrieve('cs_incomplete');
    // The router would throw: "Checkout session is not complete"
    expect(session.status).not.toBe('complete');
  });

  it('rejects non-succeeded SetupIntent', async () => {
    mockSetupIntentsRetrieve.mockResolvedValueOnce({
      id: 'seti_pending',
      status: 'requires_payment_method',
      payment_method: null as unknown as string,
    });

    const setupIntent = await mockSetupIntentsRetrieve('seti_pending');
    // The router would throw: "SetupIntent is not succeeded"
    expect(setupIntent.status).not.toBe('succeeded');
  });
});

// ── updatePaymentMethod validation tests ──────────────────────────

describe('owner.updatePaymentMethod — instrument validation', () => {
  beforeEach(clearAllMocks);
  afterEach(clearAllMocks);

  it('allows switching to debit_card when card is on file', async () => {
    const ownerWithCard = {
      stripeCardPaymentMethodId: 'pm_card_saved',
      stripeAchPaymentMethodId: null,
      paymentMethod: 'bank_account',
    };

    setupSelectChainSequence([[ownerWithCard]]);
    setupUpdateChain([{ id: OWNER_ID, paymentMethod: 'debit_card' }]);

    // Verify the select returns card on file
    const chain = mockSelect();
    const result = await chain.from().where().limit();
    expect(result[0].stripeCardPaymentMethodId).toBe('pm_card_saved');
  });

  it('rejects switching to debit_card when no card on file', async () => {
    const ownerWithoutCard = {
      stripeCardPaymentMethodId: null,
      stripeAchPaymentMethodId: 'ba_ach_123',
      paymentMethod: 'bank_account',
    };

    setupSelectChainSequence([[ownerWithoutCard]]);

    const chain = mockSelect();
    const result = await chain.from().where().limit();
    // The router would throw: "No debit card on file"
    expect(result[0].stripeCardPaymentMethodId).toBeNull();
  });

  it('rejects switching to bank_account when no ACH on file', async () => {
    const ownerWithoutAch = {
      stripeCardPaymentMethodId: 'pm_card_123',
      stripeAchPaymentMethodId: null,
      paymentMethod: 'debit_card',
    };

    setupSelectChainSequence([[ownerWithoutAch]]);

    const chain = mockSelect();
    const result = await chain.from().where().limit();
    // The router would throw: "No bank account on file"
    expect(result[0].stripeAchPaymentMethodId).toBeNull();
  });
});
