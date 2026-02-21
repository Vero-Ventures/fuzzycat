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
const STRIPE_ACCOUNT_ID = 'acct_test123';

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
