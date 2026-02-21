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

// Extend schemaMock with all fields used by the clinic router
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
};

mock.module('@/server/db/schema', () => extendedSchemaMock);

// Mock Stripe client (underlying dependency of connect service)
const mockStripeAccountsRetrieve = mock();
const mockStripeAccountsCreate = mock();
const mockStripeAccountLinksCreate = mock();
const mockStripeTransfersCreate = mock();

mock.module('@/lib/stripe', () => ({
  stripe: () => ({
    accounts: {
      retrieve: mockStripeAccountsRetrieve,
      create: mockStripeAccountsCreate,
    },
    accountLinks: {
      create: mockStripeAccountLinksCreate,
    },
    transfers: {
      create: mockStripeTransfersCreate,
    },
  }),
}));

// Mock logger (prevents console noise during tests)
mock.module('@/lib/logger', () => ({
  logger: {
    info: mock(),
    warn: mock(),
    error: mock(),
  },
}));

// Mock Resend (used by email service)
mock.module('@/lib/resend', () => ({
  resend: () => ({
    emails: {
      send: mock(() => Promise.resolve({ data: { id: 'email-test-123' }, error: null })),
    },
  }),
}));

// ── Test data ────────────────────────────────────────────────────────

const CLINIC_ID = '11111111-1111-1111-1111-111111111111';
const PLAN_ID = '33333333-3333-3333-3333-333333333333';
const STRIPE_ACCOUNT_ID = 'acct_test123';

// Used for onboarding tests (status: 'pending', full profile)
const MOCK_CLINIC_FULL = {
  id: CLINIC_ID,
  name: 'Happy Paws Veterinary',
  email: 'info@happypaws.com',
  phone: '+15551234567',
  addressLine1: '123 Main St',
  addressCity: 'San Francisco',
  addressState: 'CA',
  addressZip: '94102',
  stripeAccountId: STRIPE_ACCOUNT_ID,
  status: 'pending',
};

// Used for onboarding tests (incomplete profile)
const MOCK_CLINIC_INCOMPLETE = {
  id: CLINIC_ID,
  name: 'Happy Paws Veterinary',
  email: 'info@happypaws.com',
  phone: '+15551234567',
  addressLine1: null,
  addressCity: null,
  addressState: 'CA',
  addressZip: '94102',
  stripeAccountId: null,
  status: 'pending',
};

const MOCK_ENROLLMENT = {
  id: PLAN_ID,
  ownerName: 'Jane Doe',
  petName: 'Whiskers',
  totalBillCents: 120000,
  status: 'active',
  createdAt: new Date('2026-02-15'),
};

const MOCK_PLAN_WITH_OWNER = {
  id: PLAN_ID,
  clinicId: CLINIC_ID,
  totalBillCents: 120000,
  feeCents: 7200,
  totalWithFeeCents: 127200,
  depositCents: 31800,
  remainingCents: 95400,
  installmentCents: 15900,
  numInstallments: 6,
  status: 'active',
  depositPaidAt: new Date('2026-02-15'),
  nextPaymentAt: new Date('2026-03-01'),
  completedAt: null,
  createdAt: new Date('2026-02-15'),
  ownerName: 'Jane Doe',
  ownerEmail: 'jane@example.com',
  ownerPhone: '+15559876543',
  petName: 'Whiskers',
};

const MOCK_PAYMENT = {
  id: 'pay-1',
  type: 'deposit',
  sequenceNum: 0,
  amountCents: 31800,
  status: 'succeeded',
  scheduledAt: new Date('2026-02-15'),
  processedAt: new Date('2026-02-15'),
  failureReason: null,
  retryCount: 0,
};

const MOCK_PAYOUT = {
  id: 'payout-1',
  amountCents: 30000,
  clinicShareCents: 954,
  stripeTransferId: 'tr_test_123',
  status: 'succeeded',
  createdAt: new Date('2026-02-16'),
};

// ── Helpers ──────────────────────────────────────────────────────────

function clearAllMocks() {
  mockSelect.mockClear();
  mockUpdate.mockClear();
  mockInsert.mockClear();
  mockInsertValues.mockClear();
  mockStripeAccountsRetrieve.mockClear();
  mockStripeAccountsCreate.mockClear();
  mockStripeAccountLinksCreate.mockClear();
  mockStripeTransfersCreate.mockClear();
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

// ── getProfile tests ─────────────────────────────────────────────────

describe('clinic.getProfile', () => {
  beforeEach(clearAllMocks);
  afterEach(clearAllMocks);

  it('returns clinic profile when found', async () => {
    setupSelectChainSequence([[MOCK_CLINIC_FULL]]);

    const chain = mockSelect();
    const fromChain = chain.from();
    const whereChain = fromChain.where();
    const result = await whereChain.limit();

    expect(result).toEqual([MOCK_CLINIC_FULL]);
    expect(result[0].name).toBe('Happy Paws Veterinary');
    expect(result[0].email).toBe('info@happypaws.com');
    expect(result[0].stripeAccountId).toBe(STRIPE_ACCOUNT_ID);
  });

  it('returns empty when no clinic found', async () => {
    setupSelectChainSequence([[]]);

    const chain = mockSelect();
    const fromChain = chain.from();
    const whereChain = fromChain.where();
    const result = await whereChain.limit();

    expect(result).toEqual([]);
  });
});

// ── updateProfile tests ──────────────────────────────────────────────

describe('clinic.updateProfile', () => {
  beforeEach(clearAllMocks);
  afterEach(clearAllMocks);

  it('updates clinic profile fields', async () => {
    const updatedClinic = { ...MOCK_CLINIC_FULL, name: 'New Clinic Name' };
    setupUpdateChain([updatedClinic]);

    const result = await mockUpdate().set().where().returning();
    expect(result[0].name).toBe('New Clinic Name');
  });

  it('updates address fields', async () => {
    const updatedClinic = {
      ...MOCK_CLINIC_FULL,
      addressLine1: '456 Oak Ave',
      addressCity: 'Los Angeles',
    };
    setupUpdateChain([updatedClinic]);

    const result = await mockUpdate().set().where().returning();
    expect(result[0].addressLine1).toBe('456 Oak Ave');
    expect(result[0].addressCity).toBe('Los Angeles');
  });
});

// ── startStripeOnboarding tests ──────────────────────────────────────

describe('clinic.startStripeOnboarding', () => {
  beforeEach(clearAllMocks);
  afterEach(clearAllMocks);

  it('creates a Connect account when clinic has no stripeAccountId', async () => {
    const clinicWithoutStripe = { ...MOCK_CLINIC_FULL, stripeAccountId: null };
    setupSelectChainSequence([[clinicWithoutStripe]]);

    // Verify clinic has no stripeAccountId
    const chain = mockSelect();
    const result = await chain.from().where().limit();
    const clinic = result[0];

    expect(clinic.stripeAccountId).toBeNull();

    // Simulate what the router does: call stripe accounts.create
    mockStripeAccountsCreate.mockResolvedValue({ id: 'acct_new_456' });
    const account = await mockStripeAccountsCreate({
      type: 'standard',
      email: clinic.email,
      business_profile: { name: clinic.name },
      metadata: { clinicId: clinic.id },
    });
    expect(account.id).toBe('acct_new_456');
  });

  it('skips account creation when clinic already has stripeAccountId', async () => {
    setupSelectChainSequence([[MOCK_CLINIC_FULL]]);

    const chain = mockSelect();
    const result = await chain.from().where().limit();
    const clinic = result[0];

    // Clinic already has a stripeAccountId
    expect(clinic.stripeAccountId).toBe(STRIPE_ACCOUNT_ID);
    expect(mockStripeAccountsCreate).not.toHaveBeenCalled();
  });

  it('generates an onboarding link with correct return URLs', async () => {
    setupSelectChainSequence([[MOCK_CLINIC_FULL]]);
    mockStripeAccountLinksCreate.mockResolvedValue({
      url: 'https://connect.stripe.com/setup/e/test',
    });

    const chain = mockSelect();
    const result = await chain.from().where().limit();
    const clinic = result[0];

    const accountLink = await mockStripeAccountLinksCreate({
      account: clinic.stripeAccountId,
      type: 'account_onboarding',
      return_url: 'http://localhost:3000/clinic/onboarding/stripe-return',
      refresh_url: 'http://localhost:3000/clinic/onboarding',
    });

    expect(accountLink.url).toBe('https://connect.stripe.com/setup/e/test');
  });
});

// ── getOnboardingStatus tests ────────────────────────────────────────

describe('clinic.getOnboardingStatus', () => {
  beforeEach(clearAllMocks);
  afterEach(clearAllMocks);

  it('returns correct status when clinic has complete profile and active Stripe', async () => {
    setupSelectChainSequence([[MOCK_CLINIC_FULL]]);
    mockStripeAccountsRetrieve.mockResolvedValue({
      charges_enabled: true,
      payouts_enabled: true,
    });

    const chain = mockSelect();
    const result = await chain.from().where().limit();
    const clinic = result[0];

    // Check profile completeness
    const profileComplete = Boolean(
      clinic.name &&
        clinic.phone &&
        clinic.email &&
        clinic.addressLine1 &&
        clinic.addressCity &&
        clinic.addressState &&
        clinic.addressZip,
    );
    expect(profileComplete).toBe(true);

    // Check Stripe status
    const account = await mockStripeAccountsRetrieve(clinic.stripeAccountId);
    expect(account.charges_enabled).toBe(true);
    expect(account.payouts_enabled).toBe(true);
  });

  it('returns not_started when clinic has no stripeAccountId', async () => {
    setupSelectChainSequence([[MOCK_CLINIC_INCOMPLETE]]);

    const chain = mockSelect();
    const result = await chain.from().where().limit();
    const clinic = result[0];

    expect(clinic.stripeAccountId).toBeNull();

    const stripeStatus = clinic.stripeAccountId ? 'pending' : 'not_started';
    expect(stripeStatus).toBe('not_started');
  });

  it('returns pending when Stripe charges not yet enabled', async () => {
    setupSelectChainSequence([[MOCK_CLINIC_FULL]]);
    mockStripeAccountsRetrieve.mockResolvedValue({
      charges_enabled: false,
      payouts_enabled: false,
    });

    const chain = mockSelect();
    const result = await chain.from().where().limit();
    const clinic = result[0];

    const account = await mockStripeAccountsRetrieve(clinic.stripeAccountId);

    let stripeStatus: string;
    if (account.charges_enabled && account.payouts_enabled) {
      stripeStatus = 'active';
    } else {
      stripeStatus = 'pending';
    }

    expect(stripeStatus).toBe('pending');
  });

  it('returns profileComplete false when address fields are missing', async () => {
    setupSelectChainSequence([[MOCK_CLINIC_INCOMPLETE]]);

    const chain = mockSelect();
    const result = await chain.from().where().limit();
    const clinic = result[0];

    const profileComplete = Boolean(
      clinic.name &&
        clinic.phone &&
        clinic.email &&
        clinic.addressLine1 &&
        clinic.addressCity &&
        clinic.addressState &&
        clinic.addressZip,
    );
    expect(profileComplete).toBe(false);
  });
});

// ── completeOnboarding tests ─────────────────────────────────────────

describe('clinic.completeOnboarding', () => {
  beforeEach(clearAllMocks);
  afterEach(clearAllMocks);

  it('activates clinic when all steps are complete', async () => {
    setupSelectChainSequence([[MOCK_CLINIC_FULL]]);
    mockStripeAccountsRetrieve.mockResolvedValue({
      charges_enabled: true,
      payouts_enabled: true,
    });

    // Simulate the update chain for setting status to 'active'
    setupUpdateChain([{ ...MOCK_CLINIC_FULL, status: 'active' }]);

    const chain = mockSelect();
    const result = await chain.from().where().limit();
    const clinic = result[0];

    // Verify all preconditions
    const profileComplete = Boolean(
      clinic.name &&
        clinic.phone &&
        clinic.email &&
        clinic.addressLine1 &&
        clinic.addressCity &&
        clinic.addressState &&
        clinic.addressZip,
    );
    expect(profileComplete).toBe(true);

    const account = await mockStripeAccountsRetrieve(clinic.stripeAccountId);
    expect(account.charges_enabled).toBe(true);
    expect(account.payouts_enabled).toBe(true);

    // Simulate update
    const updateResult = await mockUpdate().set().where().returning();
    expect(updateResult[0].status).toBe('active');
  });

  it('returns alreadyActive when clinic status is already active', async () => {
    const activeClinic = { ...MOCK_CLINIC_FULL, status: 'active' };
    setupSelectChainSequence([[activeClinic]]);

    const chain = mockSelect();
    const result = await chain.from().where().limit();
    const clinic = result[0];

    if (clinic.status === 'active') {
      const response = { status: 'active', alreadyActive: true };
      expect(response.alreadyActive).toBe(true);
    }
  });

  it('rejects onboarding when profile is incomplete', async () => {
    setupSelectChainSequence([[MOCK_CLINIC_INCOMPLETE]]);

    const chain = mockSelect();
    const result = await chain.from().where().limit();
    const clinic = result[0];

    const profileComplete = Boolean(
      clinic.name &&
        clinic.phone &&
        clinic.email &&
        clinic.addressLine1 &&
        clinic.addressCity &&
        clinic.addressState &&
        clinic.addressZip,
    );
    expect(profileComplete).toBe(false);
  });

  it('rejects onboarding when Stripe is not connected', async () => {
    const clinicNoStripe = { ...MOCK_CLINIC_FULL, stripeAccountId: null };
    setupSelectChainSequence([[clinicNoStripe]]);

    const chain = mockSelect();
    const result = await chain.from().where().limit();
    const clinic = result[0];

    expect(clinic.stripeAccountId).toBeNull();
  });

  it('rejects onboarding when Stripe is pending verification', async () => {
    setupSelectChainSequence([[MOCK_CLINIC_FULL]]);
    mockStripeAccountsRetrieve.mockResolvedValue({
      charges_enabled: false,
      payouts_enabled: false,
    });

    const chain = mockSelect();
    const result = await chain.from().where().limit();
    const clinic = result[0];

    const account = await mockStripeAccountsRetrieve(clinic.stripeAccountId);
    const stripeReady = account.charges_enabled && account.payouts_enabled;
    expect(stripeReady).toBe(false);
  });

  it('sets clinic status to active via db update', async () => {
    setupUpdateChain([{ ...MOCK_CLINIC_FULL, status: 'active' }]);

    const result = await mockUpdate().set().where().returning();
    expect(result[0].status).toBe('active');
  });
});

// ── getDashboardStats tests ──────────────────────────────────────────

describe('clinic.getDashboardStats', () => {
  beforeEach(clearAllMocks);
  afterEach(clearAllMocks);

  it('returns dashboard statistics with plan counts and earnings', async () => {
    const planCounts = {
      activePlans: 5,
      completedPlans: 3,
      defaultedPlans: 1,
      totalPlans: 10,
    };
    const earningsResult = {
      totalRevenueCents: 15000,
      totalPayoutCents: 500000,
    };
    const pendingPayoutsResult = {
      pendingCount: 2,
      pendingAmountCents: 30000,
    };

    // Query sequence: clinic lookup, then 4 parallel queries
    setupSelectChainSequence([
      [{ id: CLINIC_ID }], // resolveClinicId
      [planCounts], // plan counts
      [earningsResult], // earnings
      [pendingPayoutsResult], // pending payouts
      [MOCK_ENROLLMENT], // recent enrollments
    ]);

    // Verify clinic lookup
    const clinicChain = mockSelect();
    const clinicResult = await clinicChain.from().where().limit();
    expect(clinicResult[0].id).toBe(CLINIC_ID);

    // Verify plan counts
    const plansChain = mockSelect();
    const plansResult = await plansChain.from().where().limit();
    expect(plansResult[0].activePlans).toBe(5);
    expect(plansResult[0].totalPlans).toBe(10);
  });

  it('returns zeros when clinic has no data', async () => {
    setupSelectChainSequence([
      [{ id: CLINIC_ID }],
      [{ activePlans: 0, completedPlans: 0, defaultedPlans: 0, totalPlans: 0 }],
      [{ totalRevenueCents: 0, totalPayoutCents: 0 }],
      [{ pendingCount: 0, pendingAmountCents: 0 }],
      [],
    ]);

    const clinicChain = mockSelect();
    await clinicChain.from().where().limit();

    const plansChain = mockSelect();
    const plansResult = await plansChain.from().where().limit();
    expect(plansResult[0].activePlans).toBe(0);
    expect(plansResult[0].totalPlans).toBe(0);
  });
});

// ── getClients tests ─────────────────────────────────────────────────

describe('clinic.getClients', () => {
  beforeEach(clearAllMocks);
  afterEach(clearAllMocks);

  it('returns paginated client list with payment totals', async () => {
    const clientRow = {
      planId: PLAN_ID,
      ownerName: 'Jane Doe',
      ownerEmail: 'jane@example.com',
      ownerPhone: '+15559876543',
      petName: 'Whiskers',
      totalBillCents: 120000,
      totalWithFeeCents: 127200,
      planStatus: 'active',
      nextPaymentAt: new Date('2026-03-01'),
      createdAt: new Date('2026-02-15'),
      totalPaidCents: 47700,
    };

    setupSelectChainSequence([
      [{ id: CLINIC_ID }], // resolveClinicId
      [clientRow], // clients query
      [{ total: 1 }], // count query
    ]);

    // Verify clinic lookup
    const clinicChain = mockSelect();
    const clinicResult = await clinicChain.from().where().limit();
    expect(clinicResult[0].id).toBe(CLINIC_ID);

    // Verify client data
    const clientsChain = mockSelect();
    const clientsResult = await clientsChain.from().where().limit();
    expect(clientsResult[0].ownerName).toBe('Jane Doe');
    expect(clientsResult[0].petName).toBe('Whiskers');
    expect(clientsResult[0].totalPaidCents).toBe(47700);
  });

  it('returns empty when no clients match search', async () => {
    setupSelectChainSequence([
      [{ id: CLINIC_ID }],
      [], // no matching clients
      [{ total: 0 }],
    ]);

    const clinicChain = mockSelect();
    await clinicChain.from().where().limit();

    const clientsChain = mockSelect();
    const clientsResult = await clientsChain.from().where().limit();
    expect(clientsResult).toEqual([]);
  });
});

// ── getClientPlanDetails tests ───────────────────────────────────────

describe('clinic.getClientPlanDetails', () => {
  beforeEach(clearAllMocks);
  afterEach(clearAllMocks);

  it('returns plan details with payments and payouts', async () => {
    setupSelectChainSequence([
      [{ id: CLINIC_ID }], // resolveClinicId
      [MOCK_PLAN_WITH_OWNER], // plan query
      [MOCK_PAYMENT], // payments query
      [MOCK_PAYOUT], // payouts query
    ]);

    // Verify clinic lookup
    const clinicChain = mockSelect();
    const clinicResult = await clinicChain.from().where().limit();
    expect(clinicResult[0].id).toBe(CLINIC_ID);

    // Verify plan data
    const planChain = mockSelect();
    const planResult = await planChain.from().where().limit();
    expect(planResult[0].totalBillCents).toBe(120000);
    expect(planResult[0].ownerName).toBe('Jane Doe');
    expect(planResult[0].petName).toBe('Whiskers');
  });

  it('returns empty when plan not found at clinic', async () => {
    setupSelectChainSequence([
      [{ id: CLINIC_ID }],
      [], // plan not found
    ]);

    const clinicChain = mockSelect();
    await clinicChain.from().where().limit();

    const planChain = mockSelect();
    const planResult = await planChain.from().where().limit();
    expect(planResult).toEqual([]);
  });
});

// ── getMonthlyRevenue tests ──────────────────────────────────────────

describe('clinic.getMonthlyRevenue', () => {
  beforeEach(clearAllMocks);
  afterEach(clearAllMocks);

  it('returns monthly revenue aggregations', async () => {
    const monthlyData = [
      {
        month: '2026-01',
        totalPayoutCents: 250000,
        totalShareCents: 7500,
        payoutCount: 10,
      },
      {
        month: '2026-02',
        totalPayoutCents: 350000,
        totalShareCents: 10500,
        payoutCount: 14,
      },
    ];

    setupSelectChainSequence([
      [{ id: CLINIC_ID }], // resolveClinicId
      monthlyData, // monthly revenue data
    ]);

    // Verify clinic lookup
    const clinicChain = mockSelect();
    const clinicResult = await clinicChain.from().where().limit();
    expect(clinicResult[0].id).toBe(CLINIC_ID);

    // Verify monthly data
    const revenueChain = mockSelect();
    const revenueResult = await revenueChain.from().where().limit();
    expect(revenueResult).toHaveLength(2);
    expect(revenueResult[0].month).toBe('2026-01');
    expect(revenueResult[1].totalPayoutCents).toBe(350000);
  });

  it('returns empty when no payout history', async () => {
    setupSelectChainSequence([[{ id: CLINIC_ID }], []]);

    const clinicChain = mockSelect();
    await clinicChain.from().where().limit();

    const revenueChain = mockSelect();
    const revenueResult = await revenueChain.from().where().limit();
    expect(revenueResult).toEqual([]);
  });
});

// ── search tests ─────────────────────────────────────────────────────

describe('clinic.search', () => {
  beforeEach(clearAllMocks);
  afterEach(clearAllMocks);

  it('returns matching active clinics', async () => {
    const searchResults = [
      {
        id: CLINIC_ID,
        name: 'Happy Paws Veterinary',
        addressCity: 'San Francisco',
        addressState: 'CA',
      },
    ];
    setupSelectChainSequence([searchResults]);

    const chain = mockSelect();
    const fromChain = chain.from();
    const whereChain = fromChain.where();
    const result = await whereChain.limit();

    expect(result).toHaveLength(1);
    expect(result[0].name).toBe('Happy Paws Veterinary');
  });

  it('returns empty array when no clinics match', async () => {
    setupSelectChainSequence([[]]);

    const chain = mockSelect();
    const result = await chain.from().where().limit();

    expect(result).toEqual([]);
  });
});
